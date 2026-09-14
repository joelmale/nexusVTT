import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { Campaign } from '@/db/schema';
import {
  campaignSchema,
  CampaignFormData,
  GAME_SYSTEMS,
  CAMPAIGN_STATUSES
} from '@/types/campaign';
import { useCampaigns } from '@/hooks/useCampaigns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { useState } from 'react';

interface CampaignFormProps {
  campaign?: Campaign;
  onSuccess?: (campaign: Campaign) => void;
  onCancel?: () => void;
}

export function CampaignForm({ campaign, onSuccess, onCancel }: CampaignFormProps) {
  const navigate = useNavigate();
  const { createCampaign, updateCampaign, setActiveCampaign } = useCampaigns();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<CampaignFormData>({
    resolver: zodResolver(campaignSchema),
    defaultValues: campaign
      ? {
          name: campaign.name,
          description: campaign.description || '',
          gameSystem: campaign.gameSystem,
          currentDate: campaign.currentDate || '',
          status: campaign.status
        }
      : {
          name: '',
          description: '',
          gameSystem: 'dnd5e',
          currentDate: '',
          status: 'planning'
        }
  });

  const onSubmit = async (data: CampaignFormData) => {
    setIsSubmitting(true);
    try {
      if (campaign) {
        // Update existing campaign
        await updateCampaign(campaign.id, data);
        if (onSuccess) {
          const updated = { ...campaign, ...data, updatedAt: Date.now() };
          onSuccess(updated);
        } else {
          navigate(`/campaigns/${campaign.id}`);
        }
      } else {
        // Create new campaign
        const newCampaign = await createCampaign(data);
        setActiveCampaign(newCampaign);
        if (onSuccess) {
          onSuccess(newCampaign);
        } else {
          navigate(`/campaigns/${newCampaign.id}`);
        }
      }
    } catch (error) {
      console.error('Failed to save campaign:', error);
      alert('Failed to save campaign. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigate('/');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Campaign Name */}
      <div className="space-y-2">
        <Label htmlFor="name">
          Campaign Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          placeholder="Enter campaign name"
          {...register('name')}
          aria-invalid={errors.name ? 'true' : 'false'}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      {/* Game System */}
      <div className="space-y-2">
        <Label htmlFor="gameSystem">
          Game System <span className="text-destructive">*</span>
        </Label>
        <Select id="gameSystem" {...register('gameSystem')}>
          {GAME_SYSTEMS.map((system) => (
            <option key={system.value} value={system.value}>
              {system.label}
            </option>
          ))}
        </Select>
        {errors.gameSystem && (
          <p className="text-sm text-destructive">{errors.gameSystem.message}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Brief description of your campaign..."
          rows={4}
          {...register('description')}
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>

      {/* Current Date (In-Game) */}
      <div className="space-y-2">
        <Label htmlFor="currentDate">Current In-Game Date</Label>
        <Input
          id="currentDate"
          placeholder="e.g., 15th of Hammer, 1492 DR"
          {...register('currentDate')}
        />
        <p className="text-xs text-muted-foreground">
          Track the current date in your campaign world
        </p>
      </div>

      {/* Status */}
      <div className="space-y-2">
        <Label htmlFor="status">Campaign Status</Label>
        <Select id="status" {...register('status')}>
          {CAMPAIGN_STATUSES.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label} - {status.description}
            </option>
          ))}
        </Select>
        {errors.status && (
          <p className="text-sm text-destructive">{errors.status.message}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 pt-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? 'Saving...'
            : campaign
            ? 'Update Campaign'
            : 'Create Campaign'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
