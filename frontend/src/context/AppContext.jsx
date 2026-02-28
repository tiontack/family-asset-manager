import { createContext, useContext, useReducer, useEffect } from 'react';
import api from '../utils/api';
import { getCurrentMonth } from '../utils/format';

const AppContext = createContext();

const initialState = {
  selectedMonth: getCurrentMonth(),
  categories: [],
  loading: false,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_MONTH':
      return { ...state, selectedMonth: action.payload };
    case 'SET_CATEGORIES':
      return { ...state, categories: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    api.get('/categories').then(res => {
      dispatch({ type: 'SET_CATEGORIES', payload: res.data });
    }).catch(err => {
      console.error('카테고리 로드 실패:', err);
    });
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
