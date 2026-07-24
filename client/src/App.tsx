import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AccountsPage from './pages/Accounts';
import OffersPage from './pages/Offers';
import GroupsPage from './pages/Groups';
import CandidatesPage from './pages/Candidates';
import PositionsPage from './pages/Positions';
import AdminRecruitersPage from './pages/AdminRecruiters';
import Apply from './pages/Apply';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/apply/:slug" element={<Apply />} />
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="offers" element={<OffersPage />} />
          <Route path="groups" element={<GroupsPage />} />
          <Route path="candidates" element={<CandidatesPage />} />
          <Route path="positions" element={<PositionsPage />} />
          <Route path="recruiters" element={<AdminRecruitersPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
