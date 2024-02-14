import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import DevPage from './DevPage'; // This is your component for drawing circles

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/orange/:id" element={<DevPage />} />
      </Routes>
    </Router>
  );
}

export default App;
