import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import LoadingScreen from './components/LoadingScreen';
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import NewTripPage from './pages/NewTripPage';
import TripPage from './pages/TripPage';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen message="Signing in..." />;

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<AuthPage />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/trips/new" element={<NewTripPage />} />
      <Route path="/trips/:tripId" element={<TripPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
