import { CampaignForm } from '@/components/campaign/CampaignForm';

export function CreateCampaignPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Create New Campaign</h1>
        <p className="text-muted-foreground">
          Start planning your next TTRPG adventure
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <CampaignForm />
      </div>
    </div>
  );
}
