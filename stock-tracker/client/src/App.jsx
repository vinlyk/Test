import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import Dashboard from './components/dashboard/Dashboard';
import PositionsTable from './components/positions/PositionsTable';
import WatchlistPage from './components/watchlist/WatchlistPage';
import TradesPage from './components/trades/TradesPage';
import PPTradesPage from './components/ppTrades/PPTradesPage';
import AddTradePage from './components/trade/AddTradePage';
import AccountSummary from './components/account/AccountSummary';
import { usePositions } from './hooks/usePositions';
import { usePrices } from './hooks/usePrices';

const pageTitles = {
  '/':           'Dashboard',
  '/positions':  'Positions',
  '/watchlist':  'Watchlist',
  '/trades':     'Trade Journal',
  '/pp-trades':  'PP Trades',
  '/add-trade':  'Add Trade',
  '/account':    'Account',
};

function Page({ title, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header title={title} />
      <div style={{ padding: '24px', flex: 1 }}>
        {children}
      </div>
    </div>
  );
}

export default function App() {
  const { reload } = usePositions();
  usePrices(); // mounts auto-refresh + cache loader

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div style={{ marginLeft: 'var(--sidebar)', flex: 1 }}>
        <Routes>
          <Route path="/" element={
            <Page title="Dashboard">
              <Dashboard />
            </Page>
          } />
          <Route path="/positions" element={
            <Page title="Positions">
              <PositionsTable onReload={reload} />
            </Page>
          } />
          <Route path="/watchlist" element={
            <Page title="Watchlist">
              <WatchlistPage />
            </Page>
          } />
          <Route path="/trades" element={
            <Page title="Trade Journal">
              <TradesPage />
            </Page>
          } />
          <Route path="/pp-trades" element={
            <Page title="PP Trades">
              <PPTradesPage />
            </Page>
          } />
          <Route path="/add-trade" element={
            <Page title="Add Trade">
              <AddTradePage />
            </Page>
          } />
          <Route path="/account" element={
            <Page title="Account Summary">
              <AccountSummary />
            </Page>
          } />
        </Routes>
      </div>
    </div>
  );
}
