import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import LoadingScreen from './components/LoadingScreen';
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import NewTripPage from './pages/NewTripPage';
import TripPage from './pages/TripPage';
import JoinTripPage from './pages/JoinTripPage';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen message="Signing in..." />;

  return (
    <Routes>
      {/* /join/:token must work whether the visitor is signed in or not.
          The page itself shows the right UI based on auth state. */}
      <Route path="/join/:token" element={<JoinTripPage />} />

      {user ? (
        <>
          <Route path="/" element={<HomePage />} />
          <Route path="/trips/new" element={<NewTripPage />} />
          <Route path="/trips/:tripId" element={<TripPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </>
      ) : (
        <Route path="*" element={<AuthPage />} />
      )}
    </Routes>
  );
}
