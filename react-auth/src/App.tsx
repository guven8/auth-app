import './App.css';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Register, Login, Nav, Home, Forgot, Reset } from './components';

function App() {
  return (
    <BrowserRouter>
      <Nav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot" element={<Forgot />} />
        <Route path="/reset/:token" element={<Reset />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
