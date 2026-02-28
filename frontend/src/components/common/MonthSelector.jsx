import { useApp } from '../../context/AppContext';
import { addMonths, formatMonth } from '../../utils/format';

export function MonthSelector() {
  const { state, dispatch } = useApp();
  const { selectedMonth } = state;

  const go = (delta) => {
    dispatch({ type: 'SET_MONTH', payload: addMonths(selectedMonth, delta) });
  };

  return (
    <div className="month-selector">
      <button className="month-btn" onClick={() => go(-1)}>◀</button>
      <span className="month-display">{formatMonth(selectedMonth)}</span>
      <button className="month-btn" onClick={() => go(1)}>▶</button>
    </div>
  );
}
