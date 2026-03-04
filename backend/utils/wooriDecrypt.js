'use strict';
/**
 * 우리은행 VestMail 보안메일 복호화 유틸리티
 * - 암호화: Twofish-CBC (HTML 내 JS 라이브러리 사용)
 * - 키 유도: SHA256(password) → IV (앞 16바이트), SHA256(IV) → Key (앞 16바이트)
 */
const crypto = require('crypto');
const vm = require('vm');

/**
 * 우리은행 보안메일 HTML 복호화
 * @param {Buffer|string} htmlInput - HTML 파일 내용
 * @param {string} password - 비밀번호 (기본: '880325')
 * @returns {string} 복호화된 HTML 문자열
 */
function decryptWooriHtml(htmlInput, password = '880325') {
  const html = Buffer.isBuffer(htmlInput) ? htmlInput.toString('utf8') : htmlInput;

  // s[0] 암호문 추출
  const sMatch = html.match(/var s= new Array\(\);s\[0\] = "([^"]+)"/);
  if (!sMatch) throw new Error('암호화된 우리은행 데이터를 찾을 수 없습니다 (s[0] 없음)');
  const s0Bytes = Array.from(Buffer.from(sMatch[1], 'base64'));

  // HTML에 내장된 Twofish JS 라이브러리 추출
  const scriptBlocks = [];
  const scriptRe = /<SCRIPT[^>]*type="text\/javascript"[^>]*>([\s\S]*?)<\/SCRIPT>/gi;
  let m;
  while ((m = scriptRe.exec(html)) !== null) {
    const c = m[1];
    if ((c.includes('b_p') && c.includes('eval')) || c.includes('vestmail_browser_info_list')) continue;
    scriptBlocks.push(c);
  }
  if (scriptBlocks.length === 0) throw new Error('JS 암호화 라이브러리를 찾을 수 없습니다');

  // Node.js crypto로 키 유도 (내장 JS x.s2는 vm 내에서 다른 값 반환)
  const sha1 = Buffer.from(crypto.createHash('sha256').update(password, 'utf8').digest());
  const sha2 = Buffer.from(crypto.createHash('sha256').update(sha1).digest());
  const F = Array.from(sha1.slice(0, 16)); // IV
  const z = Array.from(sha2.slice(0, 16)); // Key

  // vm 컨텍스트 설정
  const context = {
    console, Math, String, Array, Object, parseInt, parseFloat, isNaN, Buffer,
    encodeURIComponent: global.encodeURIComponent,
    decodeURIComponent: global.decodeURIComponent,
    RESULT: null,
  };
  vm.createContext(context);
  context.window = context;

  const stubs = `
var navigator={"platform":"MacIntel","userAgent":"Node.js","vendor":"","appVersion":""};
var vestmail_browser_info=null,vestmail_msg_auth='',vestmail_msg_auth_connect_fail='',vestmail_msg_download_link='',vestmail_msg_wrong_password='',vestmail_msg_processing='',vestmail_msg_not_supported_browser='',vestmail_msg_not_supported_device_or_browser='';
var org={style:{}},fn=undefined,vmfile_url='',bannerURL='';
var document={getElementById:function(){return{value:'',style:{},classList:{contains:function(){return false;}},className:'',appendChild:function(){},innerHTML:''};},createElement:function(){return{style:{},appendChild:function(){},setAttribute:function(){}}},body:{appendChild:function(){},removeChild:function(){}},onmouseup:null,write:function(){},close:function(){}};
function atob(b64){var bin=Buffer.from(b64,'base64');return Array.prototype.map.call(bin,function(b){return String.fromCharCode(b);}).join('');}
function btoa(s){return Buffer.from(s,'binary').toString('base64');}
function escape(s){return encodeURIComponent(s);}
function unescape(s){return s.replace(/%u([0-9A-Fa-f]{4})/g,function(_,h){return String.fromCharCode(parseInt(h,16));}).replace(/%([0-9A-Fa-f]{2})/g,function(_,h){return String.fromCharCode(parseInt(h,16));});}
${scriptBlocks.join('\n\n')}
`;

  const decryptCode = `
${stubs}
var F=${JSON.stringify(F)}, z=${JSON.stringify(z)}, s0=${JSON.stringify(s0Bytes)};
// Twofish-CBC: 앞 16바이트 = IV prefix, 나머지 복호화
x.y.B(z);
var data=s0.slice(16), iv=F.slice(0);
for(var i=0;i<data.length;i+=16){
  var prev=data.slice(i,i+16);
  x.y.O(data,i);
  for(var k=0;k<16;k++) data[i+k]^=iv[k];
  iv=prev;
}
// PKCS#7 패딩 제거
var pad=data[data.length-1];
if(pad>0&&pad<=16) data=data.slice(0,data.length-pad);
// MAC 검증 (첫 16바이트 = Key)
var macOk=data.slice(0,16).every(function(b,i){return b===z[i];});
RESULT=macOk ? x.j.X.z(data.slice(16)) : {error:'비밀번호 오류'};
`;

  vm.runInContext(decryptCode, context, { timeout: 30000 });

  if (!context.RESULT) throw new Error('복호화 결과가 없습니다');
  if (typeof context.RESULT === 'object' && context.RESULT.error) throw new Error(context.RESULT.error);

  // x.j.X.z 는 byte[] → binary string (각 바이트를 charCode로) 반환
  // UTF-8로 다시 디코딩해야 한글이 깨지지 않음
  return Buffer.from(context.RESULT, 'binary').toString('utf8');
}

/**
 * 복호화된 우리은행 HTML에서 거래내역 추출
 * 컬럼: 거래일시, 거래구분, 기재내용, 출금금액, 입금금액, 잔액, 취급점
 * @param {string} html - 복호화된 HTML
 * @returns {Array<{date,time,month,type,name,amount,balance}>}
 */
function parseWooriTransactions(html) {
  const transactions = [];
  const allTbodies = [...html.matchAll(/<tbody>([\s\S]*?)<\/tbody>/g)];

  for (const tbMatch of allTbodies) {
    const rows = [...tbMatch[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)];
    for (const rowMatch of rows) {
      const cells = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)]
        .map(m => m[1]
          .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/&nbsp;/g, ' ').replace(/<[^>]+>/g, '').trim());

      // 날짜가 없으면 건너뜀 (계좌정보 테이블 등)
      if (cells.length < 5 || !cells[0].match(/^\d{4}\.\d{2}\.\d{2}/)) continue;

      const parts = cells[0].split(' ');
      const date = parts[0].replace(/\./g, '-'); // YYYY-MM-DD
      const time = parts[1] || '';
      const month = date.slice(0, 7);
      const name = cells[2] || '';
      const withdrawal = parseInt((cells[3] || '').replace(/[^0-9]/g, '') || '0', 10);
      const deposit    = parseInt((cells[4] || '').replace(/[^0-9]/g, '') || '0', 10);
      const balance    = parseInt((cells[5] || '').replace(/[^0-9]/g, '') || '0', 10);

      const amount = withdrawal > 0 ? withdrawal : deposit;
      if (!name || amount === 0) continue;

      transactions.push({
        date, time, month,
        type: withdrawal > 0 ? '출금' : '입금',
        name, amount, balance,
      });
    }
  }
  return transactions;
}

module.exports = { decryptWooriHtml, parseWooriTransactions };
