import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from './stores/appStore';
import Home from './pages/Home';
import Routine from './pages/Routine';

const App: React.FC = () => {
  const { isLoggedIn } = useAppStore();

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route
        path="/routine"
        element={isLoggedIn ? <Routine /> : <Navigate to="/" replace />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
