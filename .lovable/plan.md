

## Add "Add to Flow" Option When Creating New Contacts

### Overview
Add an optional flow/stage selection to the "Add New Contact" dialog, allowing users to immediately place a new contact into a flow when creating them.

### Current Behavior
- The ContactFormDialog collects contact info (name, email, phone, demographics, tags)
- After saving, users must navigate to the contact profile and manually add them to a flow using a separate dialog

### Proposed UX
Add a collapsible "Add to Flow" section at the bottom of the contact form (before the Save button):
- A checkbox or toggle: "Add to a flow" (unchecked by default)
- When checked, show a dropdown to select a flow
- When a flow is selected, show a second dropdown to select a starting stage
- The flow selection defaults to the first (start) stage but allows choosing any stage

### Technical Implementation

#### 1. Modify ContactFormDialog Props & State

Add new state variables and an optional callback prop for flow enrollment:

```typescript
interface ContactFormDialogProps {
  // ... existing props
  onSaveWithFlow?: (contact: Contact, flowData: { pipelineId: string; stageId: string; stageOrder: number; defaultAssigneeUserId?: string | null } | null) => void;
}

// New state in component
const [addToFlow, setAddToFlow] = useState(false);
const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
const [pipelines, setPipelines] = useState<Pipeline[]>([]);
const [stages, setStages] = useState<Stage[]>([]);
```

#### 2. Fetch Available Pipelines

Add a query to fetch organization's pipelines when the "Add to Flow" checkbox is checked:

```typescript
const { data: pipelines } = useQuery({
  queryKey: ['org-pipelines', organization?.id],
  queryFn: async () => {
    const { data } = await supabase
      .from('pipelines')
      .select('id, name, description, icon')
      .eq('organization_id', organization!.id)
      .order('name');
    return data;
  },
  enabled: open && addToFlow && !!organization
});
```

#### 3. Fetch Stages When Pipeline Selected

```typescript
const { data: stages } = useQuery({
  queryKey: ['pipeline-stages', selectedPipelineId],
  queryFn: async () => {
    const { data } = await supabase
      .from('pipeline_stages')
      .select('id, name, color, stage_order, default_assignee_user_id, is_start_step')
      .eq('pipeline_id', selectedPipelineId)
      .order('stage_order');
    return data;
  },
  enabled: !!selectedPipelineId
});
```

#### 4. Add UI Section in the Form

Add a new section before the Save button:

```tsx
{/* Add to Flow Section - Only for new contacts */}
{!contact && (
  <div className="space-y-4 pt-4 border-t">
    <div className="flex items-center space-x-2">
      <Checkbox
        id="addToFlow"
        checked={addToFlow}
        onCheckedChange={(checked) => {
          setAddToFlow(!!checked);
          if (!checked) {
            setSelectedPipelineId(null);
            setSelectedStageId(null);
          }
        }}
      />
      <Label htmlFor="addToFlow" className="text-sm font-medium cursor-pointer">
        Add to a flow
      </Label>
    </div>

    {addToFlow && (
      <div className="space-y-3 pl-6">
        <div className="space-y-2">
          <Label>Select Flow</Label>
          <Select value={selectedPipelineId || ""} onValueChange={setSelectedPipelineId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a flow..." />
            </SelectTrigger>
            <SelectContent>
              {pipelines?.map((pipeline) => (
                <SelectItem key={pipeline.id} value={pipeline.id}>
                  {pipeline.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedPipelineId && stages && stages.length > 0 && (
          <div className="space-y-2">
            <Label>Select Stage</Label>
            <Select value={selectedStageId || ""} onValueChange={setSelectedStageId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a stage..." />
              </SelectTrigger>
              <SelectContent>
                {stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.name} {stage.is_start_step && "(Start)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    )}
  </div>
)}
```

#### 5. Modify handleSubmit to Include Flow Data

Update the submit handler to pass flow enrollment data:

```typescript
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  
  const finalContact = {
    id: contact?.id || Math.random().toString(36).substring(2, 10),
    ...formData
  } as Contact;
  
  // Include flow data if selected
  const flowData = addToFlow && selectedPipelineId && selectedStageId
    ? {
        pipelineId: selectedPipelineId,
        stageId: selectedStageId,
        stageOrder: stages?.find(s => s.id === selectedStageId)?.stage_order || 0,
        defaultAssigneeUserId: stages?.find(s => s.id === selectedStageId)?.default_assignee_user_id
      }
    : null;
  
  onSave(finalContact, flowData);
};
```

#### 6. Update ContactsPage.tsx Save Handler

Modify `handleSaveContact` to also insert into `pipeline_contacts` if flow data is provided:

```typescript
const handleSaveContact = async (contact: Contact, flowData?: { 
  pipelineId: string; 
  stageId: string; 
  stageOrder: number;
  defaultAssigneeUserId?: string | null;
} | null) => {
  // ... existing contact save logic ...

  // After successfully creating the contact, add to flow if requested
  if (flowData && newContact) {
    const { error: flowError } = await supabase
      .from('pipeline_contacts')
      .insert({
        contact_id: newContact.id,
        pipeline_id: flowData.pipelineId,
        stage_id: flowData.stageId,
        stage_order: flowData.stageOrder,
        assigned_to_user_id: flowData.defaultAssigneeUserId || null,
        source_type: 'manual'
      });

    if (flowError) {
      console.error('Error adding contact to flow:', flowError);
      // Contact was created but flow enrollment failed - show partial success
      toast.warning(`Contact "${contact.name}" created, but failed to add to flow`);
    } else {
      toast.success(`Contact "${contact.name}" added and enrolled in flow!`);
    }
  }
};
```

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/crm/ContactFormDialog.tsx` | Add flow selection UI, state, queries, and update submit handler |
| `src/pages/ContactsPage.tsx` | Update `handleSaveContact` to accept flow data and insert into `pipeline_contacts` |

### Edge Cases Handled
- Flow selection is optional (checkbox unchecked by default)
- Only shown for new contacts, not when editing existing ones
- Auto-selects start stage when a flow is chosen (if `is_start_step` is set)
- Respects stage's `default_assignee_user_id` for auto-assignment
- Graceful handling if flow enrollment fails after contact creation

