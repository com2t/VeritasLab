import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'; // 없으면 이 줄은 지워도 됨

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error("Root element with id 'root' not found");
}

const root = ReactDOM.createRoot(rootElement as HTMLElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
