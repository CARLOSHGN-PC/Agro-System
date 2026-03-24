import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { OrdemCorteFormModal } from './src/modules/estimativas/components/OrdemCorteFormModal';

const App = () => {
    const [isOpen, setIsOpen] = useState(true);

    return (
        <div style={{ height: '100vh', width: '100vw', background: '#222' }}>
            <button onClick={() => setIsOpen(true)}>Abrir Modal</button>
            <OrdemCorteFormModal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                onConfirm={console.log}
                talhoesCount={3}
                companyId="test_company"
            />
        </div>
    );
};

const root = createRoot(document.getElementById('root'));
root.render(<App />);
