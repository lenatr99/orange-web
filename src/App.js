import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import DevPage from './DevPage'; // DevPage is where you'll implement the circle drawing

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/orange/dev" element={<DevPage />} />
        // Define other routes here
      </Routes>
    </Router>
  );
}

export default App;