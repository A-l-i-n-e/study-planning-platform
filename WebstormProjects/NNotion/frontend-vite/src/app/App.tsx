import { useEffect } from 'react';
import { AppRouter } from './router/AppRouter';

function App() {
    useEffect(() => {
        const storedTheme = localStorage.getItem('appTheme');

        if (storedTheme === 'light' || storedTheme === 'gray' || storedTheme === 'dark') {
            document.documentElement.dataset.theme = storedTheme;
        }
    }, []);

    return <AppRouter />;
}

export default App;
