import { useState } from 'react';
import { useCampaignStore } from '@/stores/campaignStore';
import { useWorlds } from '@/hooks/useWorlds';
import { WorldForm } from '@/components/world/WorldForm';
import { WorldFormData } from '@/types/world';
import { World } from '@/db/schema';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tree, NodeRendererProps } from 'react-arborist';
import {
  Globe,
  Plus,
  Edit,
  Trash2,
  Copy,
  MapPin,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { WORLD_TYPES } from '@/types/world';

interface TreeNode {
  id: string;
  name: string;
  children?: TreeNode[];
  data: World;
}

export function WorldsPage() {
  const { activeCampaign } = useCampaignStore();
  const {
    worlds,
    createWorld,
    updateWorld,
    deleteWorld,
    duplicateWorld,
    buildWorldTree,
  } = useWorlds(activeCampaign?.id);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedWorld, setSelectedWorld] = useState<World | null>(null);
  const [parentWorldId, setParentWorldId] = useState<string | undefined>(undefined);

  if (!activeCampaign) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Globe className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold">No Active Campaign</h2>
          <p className="mt-2 text-muted-foreground">
            Select or create a campaign to start building worlds.
          </p>
        </div>
      </div>
    );
  }

  // Convert worlds to tree structure
  const treeData: TreeNode[] = buildWorldTree(worlds).map((world) =>
    convertToTreeNode(world)
  );

  function convertToTreeNode(world: World & { children?: World[] }): TreeNode {
    return {
      id: world.id,
      name: world.name,
      data: world,
      children: world.children?.map(convertToTreeNode) || [],
    };
  }

  const handleCreate = async (data: WorldFormData, campaignId: string) => {
    await createWorld(campaignId, data);
    setShowCreateDialog(false);
    setParentWorldId(undefined);
  };

  const handleUpdate = async (data: WorldFormData) => {
    if (selectedWorld) {
      await updateWorld(selectedWorld.id, data);
      setShowEditDialog(false);
      setSelectedWorld(null);
    }
  };

  const handleDelete = async (world: World) => {
    if (
      confirm(
        `Delete "${world.name}" and all its child locations? This action cannot be undone.`
      )
    ) {
      await deleteWorld(world.id);
      setSelectedWorld(null);
    }
  };

  const handleDuplicate = async (world: World) => {
    await duplicateWorld(world.id);
  };

  const handleAddChild = (world: World) => {
    setParentWorldId(world.id);
    setShowCreateDialog(true);
  };

  const handleEdit = (world: World) => {
    setSelectedWorld(world);
    setShowEditDialog(true);
  };

  // Tree node renderer
  function Node({ node, style, dragHandle }: NodeRendererProps<TreeNode>) {
    const world: World = node.data.data;
    const worldType = WORLD_TYPES.find((t) => t.value === world.type);

    return (
      <div
        ref={dragHandle}
        style={style}
        className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent"
      >
        {/* Toggle button */}
        <button
          onClick={() => node.toggle()}
          className="flex h-5 w-5 items-center justify-center rounded hover:bg-accent"
        >
          {node.isInternal ? (
            node.isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )
          ) : (
            <div className="w-4" />
          )}
        </button>

        {/* World icon */}
        <span className="text-xl">{worldType?.icon || '📍'}</span>

        {/* World name */}
        <span className="flex-1 font-medium">{world.name}</span>

        {/* World type badge */}
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
          {worldType?.label}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => handleAddChild(world)}
            title="Add child location"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => handleEdit(world)}
            title="Edit"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => handleDuplicate(world)}
            title="Duplicate"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => handleDelete(world)}
            title="Delete"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">World Builder</h1>
            <p className="mt-1 text-muted-foreground">
              Create hierarchical locations for {activeCampaign.name}
            </p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New World
          </Button>
        </div>

        {/* Stats */}
        <div className="mt-4 flex gap-4">
          <div className="rounded-lg bg-accent p-3">
            <div className="text-2xl font-bold">{worlds.length}</div>
            <div className="text-sm text-muted-foreground">Total Locations</div>
          </div>
        </div>
      </div>

      {/* Tree View */}
      <div className="flex-1 overflow-hidden p-6">
        {treeData.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <MapPin className="mx-auto h-12 w-12 text-muted-foreground" />
              <h2 className="mt-4 text-xl font-semibold">No Worlds Yet</h2>
              <p className="mt-2 text-muted-foreground">
                Create your first world or location to get started.
              </p>
              <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create World
              </Button>
            </div>
          </div>
        ) : (
          <div className="h-full rounded-lg border bg-card">
            <Tree
              data={treeData}
              openByDefault={false}
              width="100%"
              height={600}
              indent={24}
              rowHeight={48}
            >
              {Node}
            </Tree>
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Create New World</DialogTitle>
          </DialogHeader>
          <WorldForm
            campaignId={activeCampaign.id}
            parentWorldId={parentWorldId}
            onSubmit={handleCreate}
            onCancel={() => {
              setShowCreateDialog(false);
              setParentWorldId(undefined);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Edit World</DialogTitle>
          </DialogHeader>
          {selectedWorld && (
            <WorldForm
              world={selectedWorld}
              campaignId={activeCampaign.id}
              onSubmit={handleUpdate}
              onCancel={() => {
                setShowEditDialog(false);
                setSelectedWorld(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
