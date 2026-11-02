import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { Navbar } from '@/widgets/navbar';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/app/router/route-paths';
import { DEMO_NOTICE, IS_DEMO } from '@/shared/demo/config';
import { tokenStorage } from '@/shared/lib/token-storage';
import { Button } from '@/shared/ui/button/Button';
import './PageLayout.scss';

interface PageLayoutProps {
    children: ReactNode;
    className?: string;
    withNavbar?: boolean;
}

export const PageLayout = ({ children, className, withNavbar = true }: PageLayoutProps) => {
    const navigate = useNavigate();
    const changeRole = () => {
        tokenStorage.clearAuth();
        navigate(ROUTES.LOGIN, { replace: true });
    };

    return (
        <div className={cn('app-layout', !withNavbar && 'app-layout--auth', className)}>
            <div className="app-layout__frame">
                {IS_DEMO ? (
                    <aside className="demo-notice" aria-label="О демо-версии">
                        <p>{DEMO_NOTICE}</p>
                        {withNavbar ? <Button size="sm" variant="secondary" onClick={changeRole}>Сменить роль</Button> : null}
                    </aside>
                ) : null}
                {withNavbar ? <Navbar /> : null}
                <main className="app-layout__content">{children}</main>
            </div>
        </div>
    );
};
