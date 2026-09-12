import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { worldSchema, WorldFormData, WORLD_TYPES, CLIMATE_OPTIONS } from '@/types/world';
import { World } from '@/db/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import SelectRoot, {
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface WorldFormProps {
  world?: World;
  parentWorldId?: string;
  campaignId: string;
  onSubmit: (data: WorldFormData, campaignId: string) => Promise<void>;
  onCancel: () => void;
}

export function WorldForm({ world, parentWorldId, campaignId, onSubmit, onCancel }: WorldFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<WorldFormData>({
    resolver: zodResolver(worldSchema),
    defaultValues: world
      ? {
          name: world.name,
          description: world.description || '',
          type: world.type,
          parentWorldId: world.parentWorldId,
          geography: world.geography || '',
          climate: world.climate || '',
          population: world.population,
          government: world.government || '',
          factions: world.factions || [],
          points_of_interest: world.points_of_interest || [],
          map_url: world.map_url || '',
          notes: world.notes || '',
        }
      : {
          name: '',
          description: '',
          type: 'location',
          parentWorldId: parentWorldId,
          geography: '',
          climate: '',
          population: undefined,
          government: '',
          factions: [],
          points_of_interest: [],
          map_url: '',
          notes: '',
        },
  });

  const selectedType = watch('type');

  const handleFormSubmit = (data: WorldFormData) => {
    return onSubmit(data, campaignId);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Basic Info */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Basic Information</h3>

        <div>
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            {...register('name')}
            placeholder="Enter world/location name"
            className={errors.name ? 'border-destructive' : ''}
          />
          {errors.name && (
            <p className="mt-1 text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="type">Type *</Label>
          <SelectRoot
            value={selectedType}
            onValueChange={(value) => setValue('type', value as World['type'])}
          >
            <SelectTrigger id="type">
              <SelectValue placeholder="Select world type" />
              <SelectContent>
                {WORLD_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.icon} {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </SelectTrigger>
          </SelectRoot>
          {errors.type && (
            <p className="mt-1 text-sm text-destructive">{errors.type.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            {...register('description')}
            placeholder="Brief description of this location"
            rows={3}
          />
        </div>
      </div>

      {/* Geography & Climate */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Geography & Climate</h3>

        <div>
          <Label htmlFor="geography">Geography</Label>
          <Textarea
            id="geography"
            {...register('geography')}
            placeholder="Describe terrain, features, landmarks..."
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="climate">Climate</Label>
          <SelectRoot
            value={watch('climate') || ''}
            onValueChange={(value) => setValue('climate', value)}
          >
            <SelectTrigger id="climate">
              <SelectValue placeholder="Select climate" />
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {CLIMATE_OPTIONS.map((climate) => (
                  <SelectItem key={climate} value={climate}>
                    {climate}
                  </SelectItem>
                ))}
              </SelectContent>
            </SelectTrigger>
          </SelectRoot>
        </div>
      </div>

      {/* Society & Politics */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Society & Politics</h3>

        <div>
          <Label htmlFor="population">Population</Label>
          <Input
            id="population"
            type="number"
            {...register('population', { valueAsNumber: true })}
            placeholder="Estimated population"
            min={0}
          />
        </div>

        <div>
          <Label htmlFor="government">Government</Label>
          <Input
            id="government"
            {...register('government')}
            placeholder="Type of government or leadership"
          />
        </div>
      </div>

      {/* Map & Notes */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Additional Details</h3>

        <div>
          <Label htmlFor="map_url">Map URL</Label>
          <Input
            id="map_url"
            {...register('map_url')}
            placeholder="https://example.com/map.png"
            type="url"
          />
          {errors.map_url && (
            <p className="mt-1 text-sm text-destructive">{errors.map_url.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            {...register('notes')}
            placeholder="Additional DM notes about this location..."
            rows={4}
          />
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-3 border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : world ? 'Update World' : 'Create World'}
        </Button>
      </div>
    </form>
  );
}
