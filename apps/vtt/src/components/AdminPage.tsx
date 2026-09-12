import React, { useState } from 'react';
import { getDataManager } from '@/utils/dataManager';
import { DataTable } from './DataTable';
import { DataModal } from './DataModal';
import type { Weapon, Armor } from '@/types/character';

export const AdminPage: React.FC = () => {
  // Hooks must be called before any conditional returns
  const [activeTab, setActiveTab] = useState('weapons');
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    mode: 'add' | 'edit';
    dataType: string;
    initialData?: Partial<Weapon> | Partial<Armor>;
  }>({
    isOpen: false,
    mode: 'add',
    dataType: '',
  });

  // Only allow admin access in development mode
  if (process.env.NODE_ENV !== 'development') {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-6 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-gray-400">
            Admin panel is only available in development mode.
          </p>
        </div>
      </div>
    );
  }

  const dataManager = getDataManager();

  const openAddModal = (dataType: string) => {
    setModalState({
      isOpen: true,
      mode: 'add',
      dataType,
    });
  };

  const openEditModal = (dataType: string, data: Weapon | Armor) => {
    setModalState({
      isOpen: true,
      mode: 'edit',
      dataType,
      initialData: data,
    });
  };

  const closeModal = () => {
    setModalState({
      isOpen: false,
      mode: 'add',
      dataType: '',
    });
  };

  const handleModalSave = (data: Partial<Weapon> | Partial<Armor>) => {
    const { dataType, mode, initialData } = modalState;

    switch (dataType) {
      case 'weapons':
        if (mode === 'add') {
          dataManager.addWeapon(data as Omit<Weapon, 'id'>);
        } else if (initialData && initialData.id) {
          dataManager.updateWeapon(initialData.id, data as Partial<Weapon>);
        }
        break;
      case 'armor':
        if (mode === 'add') {
          dataManager.addArmor(data as Omit<Armor, 'id'>);
        } else if (initialData && initialData.id) {
          dataManager.updateArmor(initialData.id, data as Partial<Armor>);
        }
        break;
      // Add other data types here
    }

    // Force re-render
    window.location.reload();
  };

  const getModalFields = (dataType: string) => {
    switch (dataType) {
      case 'weapons':
        return [
          { key: 'name', label: 'Name', type: 'text' as const, required: true },
          {
            key: 'type',
            label: 'Type',
            type: 'select' as const,
            required: true,
            options: [
              { value: 'simple', label: 'Simple' },
              { value: 'martial', label: 'Martial' },
            ],
          },
          {
            key: 'category',
            label: 'Category',
            type: 'select' as const,
            required: true,
            options: [
              { value: 'melee', label: 'Melee' },
              { value: 'ranged', label: 'Ranged' },
            ],
          },
          {
            key: 'damage',
            label: 'Damage',
            type: 'text' as const,
            placeholder: 'e.g., 1d8',
          },
          {
            key: 'properties',
            label: 'Properties',
            type: 'text' as const,
            placeholder: 'Comma-separated',
          },
          { key: 'weight', label: 'Weight', type: 'number' as const },
          { key: 'cost', label: 'Cost', type: 'text' as const },
        ];
      case 'armor':
        return [
          { key: 'name', label: 'Name', type: 'text' as const, required: true },
          {
            key: 'type',
            label: 'Type',
            type: 'select' as const,
            required: true,
            options: [
              { value: 'light', label: 'Light' },
              { value: 'medium', label: 'Medium' },
              { value: 'heavy', label: 'Heavy' },
              { value: 'shield', label: 'Shield' },
            ],
          },
          {
            key: 'ac',
            label: 'Armor Class',
            type: 'number' as const,
            required: true,
          },
          {
            key: 'strengthRequirement',
            label: 'Strength Requirement',
            type: 'number' as const,
          },
          {
            key: 'stealthDisadvantage',
            label: 'Stealth Disadvantage',
            type: 'checkbox' as const,
          },
          { key: 'weight', label: 'Weight', type: 'number' as const },
          { key: 'cost', label: 'Cost', type: 'text' as const },
        ];
      default:
        return [];
    }
  };

  const tabs = [
    { id: 'weapons', label: 'Weapons', count: dataManager.getWeapons().length },
    { id: 'armor', label: 'Armor', count: dataManager.getArmor().length },
    { id: 'tools', label: 'Tools', count: dataManager.getTools().length },
    { id: 'spells', label: 'Spells', count: dataManager.getSpells().length },
    {
      id: 'equipment',
      label: 'Equipment',
      count: dataManager.getEquipment().length,
    },
    {
      id: 'features',
      label: 'Features',
      count: dataManager.getFeatures().length,
    },
    { id: 'classes', label: 'Classes', count: dataManager.getClasses().length },
    { id: 'races', label: 'Races', count: dataManager.getRaces().length },
    {
      id: 'backgrounds',
      label: 'Backgrounds',
      count: dataManager.getBackgrounds().length,
    },
    { id: 'personality', label: 'Personality', count: 1 },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'weapons':
        return (
          <WeaponTab
            onAdd={() => openAddModal('weapons')}
            onEdit={openEditModal}
          />
        );
      case 'armor':
        return (
          <ArmorTab
            onAdd={() => openAddModal('armor')}
            onEdit={openEditModal}
          />
        );
      case 'tools':
        return <ToolTab />;
      case 'spells':
        return <SpellTab />;
      case 'equipment':
        return <EquipmentTab />;
      case 'features':
        return <FeatureTab />;
      case 'classes':
        return <ClassTab />;
      case 'races':
        return <RaceTab />;
      case 'backgrounds':
        return <BackgroundTab />;
      case 'personality':
        return <PersonalityTab />;
      default:
        return <div>Select a tab to view data</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Admin Panel</h1>
          <p className="text-gray-400">
            Manage character generation data for D&D 5e
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-700 pb-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-lg ring-2 ring-blue-400'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="glass-panel p-6">
          {renderTabContent()}

          {/* Save Actions */}
          <div className="mt-6 pt-6 border-t border-gray-600">
            <div className="flex gap-3 justify-end">
              <button
                onClick={async () => {
                  const result = await dataManager.saveToCode();
                  alert(result.message);
                  if (result.success) {
                    console.log('Saved files:', result.files);
                  }
                }}
                className="glass-button primary"
              >
                💾 Save to Code Files
              </button>
              <button
                onClick={() => {
                  const data = dataManager.exportDataFile();
                  const blob = new Blob([data], {
                    type: 'text/typescript;charset=utf-8',
                  });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = 'character-data.ts';
                  link.style.display = 'none';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  URL.revokeObjectURL(url);
                }}
                className="glass-button secondary"
              >
                📄 Export Complete Data File
              </button>
            </div>
            <p className="text-sm text-gray-400 mt-2">
              Save to Code Files will generate individual TypeScript files for
              each data type. Export Complete Data File creates a single file
              with all data.
            </p>
          </div>
        </div>
      </div>

      {/* Modal */}
      {modalState.isOpen && (
        <DataModal
          isOpen
          onClose={closeModal}
          onSave={handleModalSave}
          title={modalState.dataType}
          fields={getModalFields(modalState.dataType)}
          initialData={modalState.initialData}
          mode={modalState.mode}
        />
      )}
    </div>
  );
};

// Tab components with DataTable
const WeaponTab: React.FC<{
  onAdd: () => void;
  onEdit: (dataType: string, data: Weapon) => void;
}> = ({ onAdd, onEdit }) => {
  const dataManager = getDataManager();
  const weapons = dataManager.getWeapons();

  const columns: Array<{
    key: keyof Weapon | string;
    label: string;
    sortable?: boolean;
    render?: (value: Weapon[keyof Weapon], item: Weapon) => React.ReactNode;
  }> = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'type', label: 'Type', sortable: true },
    { key: 'category', label: 'Category', sortable: true },
    { key: 'damage', label: 'Damage', sortable: true },
    {
      key: 'properties',
      label: 'Properties',
      render: (value) => (Array.isArray(value) ? value.join(', ') : ''),
    },
    { key: 'weight', label: 'Weight', sortable: true },
    { key: 'cost', label: 'Cost' },
  ];

  const handleDelete = (id: string) => {
    dataManager.deleteWeapon(id);
    window.location.reload();
  };

  return (
    <DataTable
      data={weapons}
      columns={columns}
      onAdd={onAdd}
      onEdit={(weapon) => onEdit('weapons', weapon)}
      onDelete={handleDelete}
      searchPlaceholder="Search weapons..."
      title="Weapons"
    />
  );
};

const ArmorTab: React.FC<{
  onAdd: () => void;
  onEdit: (dataType: string, data: Armor) => void;
}> = ({ onAdd, onEdit }) => {
  const dataManager = getDataManager();
  const armor = dataManager.getArmor();

  const columns: Array<{
    key: keyof Armor | string;
    label: string;
    sortable?: boolean;
    render?: (value: Armor[keyof Armor], item: Armor) => React.ReactNode;
  }> = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'type', label: 'Type', sortable: true },
    { key: 'ac', label: 'AC', sortable: true },
    { key: 'strengthRequirement', label: 'Str Req', sortable: true },
    {
      key: 'stealthDisadvantage',
      label: 'Stealth Disadv.',
      render: (value) => (value ? 'Yes' : 'No'),
    },
    { key: 'weight', label: 'Weight', sortable: true },
    { key: 'cost', label: 'Cost' },
  ];

  const handleDelete = (id: string) => {
    dataManager.deleteArmor(id);
    window.location.reload();
  };

  return (
    <DataTable
      data={armor}
      columns={columns}
      onAdd={onAdd}
      onEdit={(armor) => onEdit('armor', armor)}
      onDelete={handleDelete}
      searchPlaceholder="Search armor..."
      title="Armor"
    />
  );
};

const ToolTab: React.FC = () => (
  <div>
    <h2 className="text-xl font-semibold mb-4">Tools</h2>
    <p className="text-gray-400">Tool management coming soon...</p>
  </div>
);

const SpellTab: React.FC = () => (
  <div>
    <h2 className="text-xl font-semibold mb-4">Spells</h2>
    <p className="text-gray-400">Spell management coming soon...</p>
  </div>
);

const EquipmentTab: React.FC = () => (
  <div>
    <h2 className="text-xl font-semibold mb-4">Equipment</h2>
    <p className="text-gray-400">Equipment management coming soon...</p>
  </div>
);

const FeatureTab: React.FC = () => (
  <div>
    <h2 className="text-xl font-semibold mb-4">Features</h2>
    <p className="text-gray-400">Feature management coming soon...</p>
  </div>
);

const ClassTab: React.FC = () => (
  <div>
    <h2 className="text-xl font-semibold mb-4">Classes</h2>
    <p className="text-gray-400">Class management coming soon...</p>
  </div>
);

const RaceTab: React.FC = () => (
  <div>
    <h2 className="text-xl font-semibold mb-4">Races</h2>
    <p className="text-gray-400">Race management coming soon...</p>
  </div>
);

const BackgroundTab: React.FC = () => (
  <div>
    <h2 className="text-xl font-semibold mb-4">Backgrounds</h2>
    <p className="text-gray-400">Background management coming soon...</p>
  </div>
);

const PersonalityTab: React.FC = () => (
  <div>
    <h2 className="text-xl font-semibold mb-4">Personality</h2>
    <p className="text-gray-400">Personality data management coming soon...</p>
  </div>
);
