import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { IS_DEMO } from './shared/demo/config';
import App from './app/App';
import './app/styles/reset.scss';
import './app/styles/globals.scss';

const Router = IS_DEMO ? HashRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <Router>
            <App />
        </Router>
    </React.StrictMode>,
);
