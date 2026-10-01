import { createClient } from '@supabase/supabase-js';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Sync demographic data to database tables
export async function syncDemographicData(contactId: string, person: any, auth: string) {
  const attrs = person.attributes;
  const includedData = person.included_data || {};
  
  try {
    // 1. Sync demographics (birthday, marital status, occupation, gender)
    const demoData: any = {};
    
    if (attrs.birthdate) demoData.birthday = attrs.birthdate;
    if (attrs.marital_status) demoData.marital_status = attrs.marital_status;
    if (attrs.occupation) demoData.occupation = attrs.occupation;
    if (attrs.gender) demoData.gender = attrs.gender;
    if (attrs.sex) demoData.gender = attrs.sex;
    
    // Handle custom fields for demographic data
    if (includedData.fieldData && includedData.fieldData.length > 0) {
      for (const field of includedData.fieldData) {
        const fieldAttrs = field.attributes;
        const fieldName = fieldAttrs.name?.toLowerCase() || '';
        const fieldValue = fieldAttrs.value?.trim();
        
        if (fieldValue && (fieldName.includes('marital') || fieldName.includes('married') || fieldName.includes('single') || fieldName.includes('relationship status') || fieldName === 'status')) {
          demoData.marital_status = fieldValue;
        }
        
        if (fieldValue && (fieldName.includes('occupation') || fieldName.includes('job') || fieldName.includes('work') || fieldName.includes('employment') || fieldName.includes('profession'))) {
          demoData.occupation = fieldValue;
        }
      }
    }
    
    // Fallback to relationship-included marital status
    if (!demoData.marital_status && includedData.maritalStatus?.attributes) {
      const msAttrs = includedData.maritalStatus.attributes;
      demoData.marital_status = msAttrs.name || msAttrs.label || msAttrs.value || msAttrs.status || null;
    }
    
    if (!demoData.marital_status && includedData.demographic?.attributes) {
      const dAttrs = includedData.demographic.attributes;
      demoData.marital_status = dAttrs.marital_status || dAttrs.maritalStatus || null;
    }
    
    // Title-case common enum-like values
    if (typeof demoData.marital_status === 'string') {
      const s = demoData.marital_status.trim();
      if (s && s === s.toLowerCase()) {
        demoData.marital_status = s.charAt(0).toUpperCase() + s.slice(1);
      }
    }
    
    if (Object.keys(demoData).length > 0) {
      const { data: existingDemo } = await supabase
        .from('contact_demographics')
        .select('id')
        .eq('contact_id', contactId)
        .maybeSingle();
      
      if (existingDemo) {
        await supabase.from('contact_demographics').update(demoData).eq('id', existingDemo.id);
      } else {
        await supabase.from('contact_demographics').insert({ contact_id: contactId, ...demoData });
      }
    }
    
    // 2. Sync addresses
    if (includedData.addresses && includedData.addresses.length > 0) {
      await supabase.from('contact_addresses').delete().eq('contact_id', contactId);
      
      for (const [index, address] of includedData.addresses.entries()) {
        const addrAttrs = address.attributes;
        const line1 = addrAttrs.street || addrAttrs.street_address || addrAttrs.address || addrAttrs.line1 || addrAttrs.street_line_1 || null;
        const line2 = addrAttrs.street_line_2 || addrAttrs.line2 || null;
        const streetAddress = [line1, line2].filter(Boolean).join(', ') || null;
        
        await supabase.from('contact_addresses').insert({
          contact_id: contactId,
          address_type: addrAttrs.location?.toLowerCase() || 'home',
          street_address: streetAddress,
          city: addrAttrs.city,
          state: addrAttrs.state,
          zip_code: addrAttrs.zip,
          country: addrAttrs.country_code || addrAttrs.country || 'US',
          is_primary: addrAttrs.primary || index === 0
        });
      }
    }
    
    // 3. Sync family/household data  
    if (includedData.households && includedData.households.length > 0) {
      await supabase.from('contact_family_members').delete().eq('contact_id', contactId).not('pc_person_id', 'is', null);
      
      const familyMembers = [];
      const seenPersonIds = new Set<string>();
      
      for (const household of includedData.households) {
        const householdId = household.id;
        const householdName = household.attributes?.name || 'Household';
        
        try {
          const householdResponse = await fetch(
            `https://api.planningcenteronline.com/people/v2/households/${householdId}/household_memberships?include=person`,
            { headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' } }
          );
          
          if (!householdResponse.ok) continue;
          
          const householdData = await householdResponse.json();
          const memberships = householdData.data || [];
          const includedPeople = householdData.included?.filter((i: any) => i.type === 'Person') || [];
          
          for (const membership of memberships) {
            const personId = membership.relationships?.person?.data?.id;
            if (personId === person.id || seenPersonIds.has(personId)) continue;
            
            const memberPerson = includedPeople.find((p: any) => p.id === personId);
            
            if (memberPerson) {
              const memberAttrs = memberPerson.attributes;
              const birthdate = memberAttrs.birthdate;
              let isChild = memberAttrs.child || false;
              
              if (birthdate && !isChild) {
                const age = new Date().getFullYear() - new Date(birthdate).getFullYear();
                isChild = age < 18;
              }
              
              seenPersonIds.add(personId);
              
              familyMembers.push({
                contact_id: contactId,
                name: `${memberAttrs.first_name || ''} ${memberAttrs.last_name || ''}`.trim(),
                relationship: isChild ? 'Child' : (memberAttrs.marital_status === 'Married' ? 'Spouse' : 'Household Member'),
                birthday: birthdate,
                avatar: memberAttrs.avatar || memberAttrs.demographic_avatar_url,
                is_child: isChild,
                pc_person_id: personId,
                notes: `Household: ${householdName}`
              });
            }
          }
        } catch (error) {
          console.error(`Error fetching household ${householdId}:`, error);
        }
      }
      
      if (familyMembers.length > 0) {
        await supabase.from('contact_family_members').insert(familyMembers);
      }
    }
    
    // 4. Sync custom field data as notes
    if (includedData.fieldData && includedData.fieldData.length > 0) {
      for (const field of includedData.fieldData) {
        const fieldAttrs = field.attributes;
        if (fieldAttrs.value && fieldAttrs.value.trim()) {
          const noteContent = `${fieldAttrs.name || 'Custom Field'}: ${fieldAttrs.value}`;
          const { data: existingNote } = await supabase
            .from('contact_notes')
            .select('id')
            .eq('contact_id', contactId)
            .eq('content', noteContent)
            .eq('note_type', 'planning_center_field')
            .maybeSingle();
          
          if (!existingNote) {
            await supabase.from('contact_notes').insert({
              contact_id: contactId,
              content: noteContent,
              note_type: 'planning_center_field',
              created_by_user_id: (await supabase.auth.getUser()).data.user?.id || contactId
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('Error syncing demographic data for contact:', contactId, error);
  }
}
