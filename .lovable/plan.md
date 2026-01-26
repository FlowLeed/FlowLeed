

## Plan: Fix Contact Saving on the People/Contacts Page

### Problem Confirmed
The "Add New Contact" dialog collects all the form data correctly and calls `onSave(contact)` with the full contact object. However, `ContactsPage.tsx` ignores this data completely:

```tsx
// Line 94 - Current broken code
onSave={() => setShowAddDialog(false)}  // Data is discarded!
```

**Result:** When you click "Save", the dialog closes but nothing is saved to the database.

---

### Solution: Add Database Save Logic

**File:** `src/pages/ContactsPage.tsx`

#### Changes Required:

1. **Add Imports:**
   - `supabase` from integrations
   - `useProfile` hook to get organization
   - `toast` from sonner for feedback
   - `useQueryClient` to refresh the list
   - `Contact` type from `@/types/crm`

2. **Add State/Hooks:**
   - Get `organization` from `useProfile()`
   - Get `queryClient` from `useQueryClient()`

3. **Create `handleSaveContact` Function:**
   ```tsx
   const handleSaveContact = async (contact: Contact) => {
     if (!organization) {
       toast.error("Organization not found");
       return;
     }

     try {
       // Resolve assigned user ID from assignee name
       let assignedUserId: string | null = null;
       if (contact.assignedTo?.name) {
         const { data: profiles } = await supabase
           .from('profiles')
           .select('user_id')
           .or(`full_name.ilike.${contact.assignedTo.name},email.ilike.${contact.assignedTo.name}`)
           .limit(1);
         
         if (profiles?.[0]) {
           assignedUserId = profiles[0].user_id;
         }
       }

       // Insert contact
       const { data: newContact, error } = await supabase
         .from('contacts')
         .insert({
           name: contact.name,
           email: contact.email || null,
           phone: contact.phone || null,
           status: contact.status || 'active',
           organization_id: organization.id,
           assigned_to_user_id: assignedUserId,
           source_type: 'manual'
         })
         .select()
         .single();

       if (error) throw error;

       // Insert tags if present
       if (contact.tags?.length) {
         await supabase.from('contact_tags').insert(
           contact.tags.map(tag => ({
             contact_id: newContact.id,
             tag: tag
           }))
         );
       }

       // Insert demographics if any fields are filled
       const demo = contact as any;
       if (demo.birthday || demo.occupation || demo.maritalStatus || 
           demo.streetAddress || demo.city || demo.state || demo.zipCode) {
         await supabase.from('contact_demographics').insert({
           contact_id: newContact.id,
           birthday: demo.birthday || null,
           occupation: demo.occupation || null,
           marital_status: demo.maritalStatus || null,
           street_address: demo.streetAddress || null,
           city: demo.city || null,
           state: demo.state || null,
           zip_code: demo.zipCode || null
         });
       }

       toast.success(`Contact "${contact.name}" added successfully!`);
       queryClient.invalidateQueries({ queryKey: ['all-contacts'] });
       setShowAddDialog(false);
       
     } catch (error) {
       console.error('Error saving contact:', error);
       toast.error(`Failed to save contact: ${error.message}`);
     }
   };
   ```

4. **Update the Dialog Component:**
   ```tsx
   <ContactFormDialog
     open={showAddDialog}
     onOpenChange={setShowAddDialog}
     contact={null}
     onSave={handleSaveContact}  // Use new function
   />
   ```

---

### Summary

| File | Change |
|------|--------|
| `src/pages/ContactsPage.tsx` | Add imports for `supabase`, `useProfile`, `toast`, `useQueryClient`, `Contact` |
| `src/pages/ContactsPage.tsx` | Add `handleSaveContact` function to save contact + tags + demographics to database |
| `src/pages/ContactsPage.tsx` | Replace empty `onSave` callback with `handleSaveContact` |

### Expected Result
After this fix:
- New contacts will be saved to the `contacts` table with `source_type: 'manual'`
- Tags will be saved to `contact_tags`
- Demographics will be saved to `contact_demographics`
- The contacts list will refresh immediately
- "Matthew Riveras" will appear when you add them and search for them

