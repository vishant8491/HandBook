import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar.jsx';
import { Header } from './components/Header.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { CollectPage } from './pages/CollectPage.jsx';
import { LeadsPage } from './pages/LeadsPage.jsx';
import { LeadDetailsDrawer } from './components/LeadDetailsDrawer.jsx';
import { QualificationSettingsModal } from './components/QualificationSettingsModal.jsx';
import { api } from './lib/api.js';
import { Plus, Sliders, Users } from 'lucide-react';

export function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [qualificationSettings, setQualificationSettings] = useState(null);

  useEffect(() => {
    api
      .getQualificationSettings()
      .then((res) => setQualificationSettings(res.settings))
      .catch((err) => console.error('Failed to load qualification settings:', err));
  }, []);

  const handleSaveSettings = async (newSettings) => {
    const res = await api.updateQualificationSettings(newSettings);
    setQualificationSettings(res.settings);
    if (selectedLead) {
      const refreshed = await api.getLeadById(selectedLead._id);
      setSelectedLead(refreshed.lead);
    }
  };

  const handleUpdateStatus = async (leadId, status) => {
    try {
      const res = await api.updateLead(leadId, { outreachStatus: status });
      setSelectedLead(res.lead);
    } catch (err) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  const handleSaveLeadEdit = async (leadId, formValues) => {
    try {
      const res = await api.updateLead(leadId, formValues);
      setSelectedLead(res.lead);
    } catch (err) {
      alert(`Failed to save edit: ${err.message}`);
    }
  };

  const pageMeta = {
    dashboard: {
      title: 'Overview',
      description: 'Lead generation pipeline status and decision metrics.',
      primaryAction: {
        label: 'Collect leads',
        icon: <Plus className="w-3.5 h-3.5" />,
        onClick: () => setCurrentPage('collect'),
      },
    },
    collect: {
      title: 'Collect Leads',
      description: 'Extract public business profiles with SSRF defense and deduplication.',
      primaryAction: {
        label: 'View directory',
        icon: <Users className="w-3.5 h-3.5" />,
        onClick: () => setCurrentPage('leads'),
      },
    },
    leads: {
      title: 'Leads Directory',
      description: 'Prioritize companies by target criteria and public contact availability.',
      primaryAction: {
        label: 'Target criteria',
        icon: <Sliders className="w-3.5 h-3.5" />,
        onClick: () => setIsSettingsOpen(true),
      },
    },
  };

  const currentMeta = pageMeta[currentPage] || pageMeta.dashboard;

  return (
    <div className="flex h-screen bg-bg overflow-hidden font-sans text-ink">
      {/* Left Sidebar */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-bg">
        <Header
          title={currentMeta.title}
          description={currentMeta.description}
          primaryAction={currentMeta.primaryAction}
          onOpenMobile={() => setIsMobileOpen(true)}
        />

        <main className="flex-1 overflow-y-auto">
          {currentPage === 'dashboard' && (
            <DashboardPage
              onNavigate={setCurrentPage}
              onSelectLead={setSelectedLead}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
          )}

          {currentPage === 'collect' && (
            <CollectPage
              onNavigate={setCurrentPage}
              onSelectLead={setSelectedLead}
            />
          )}

          {currentPage === 'leads' && (
            <LeadsPage
              onSelectLead={setSelectedLead}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
          )}
        </main>
      </div>

      {/* Lead Details Drawer */}
      <LeadDetailsDrawer
        lead={selectedLead}
        isOpen={Boolean(selectedLead)}
        onClose={() => setSelectedLead(null)}
        onUpdateStatus={handleUpdateStatus}
        onSaveLeadEdit={handleSaveLeadEdit}
      />

      {/* Qualification Settings Modal */}
      <QualificationSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentSettings={qualificationSettings}
        onSave={handleSaveSettings}
      />
    </div>
  );
}

export default App;
