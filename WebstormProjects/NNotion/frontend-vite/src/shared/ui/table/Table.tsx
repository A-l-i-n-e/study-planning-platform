import type { ReactNode } from 'react';
import { Card } from '@/shared/ui/card/Card';

export interface TableColumn<T> {
    header: string;
    key: string;
    render: (row: T) => ReactNode;
}

interface TableProps<T> {
    columns: Array<TableColumn<T>>;
    data: T[];
    emptyState?: ReactNode;
    getRowKey: (row: T) => string;
}

export const Table = <T,>({ columns, data, emptyState, getRowKey }: TableProps<T>) => {
    if (data.length === 0) {
        return <Card>{emptyState ?? 'Нет данных для отображения.'}</Card>;
    }

    return (
        <Card className="table-shell">
            <table className="ui-table">
                <thead>
                    <tr>
                        {columns.map((column) => (
                            <th key={column.key}>{column.header}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.map((row) => (
                        <tr key={getRowKey(row)}>
                            {columns.map((column) => (
                                <td key={column.key}>{column.render(row)}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </Card>
    );
};
