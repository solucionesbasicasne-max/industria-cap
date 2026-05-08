import React from 'react';
import Sidebar from './components/Sidebar';
import ExecutiveDashboard from './modules/Dashboard/ExecutiveDashboard';

function App() {
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <ExecutiveDashboard />
      </main>
    </div>
  );
}

export default App;
