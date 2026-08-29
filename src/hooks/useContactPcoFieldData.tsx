import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PcoFieldDef {
  id: string;
  name: string;
  dataType: string;
  sequence: number;
  tabName: string;
}

export interface PcoTabGroup {
  tabName: string;
  fields: PcoFieldDef[];
}

interface ContactPcoFieldData {
  fields: PcoFieldDef[];
  tabs: PcoTabGroup[];
  values: Record<string, string>;
  personMissing?: boolean;
  notLinked?: boolean;
}


export function useContactPcoFieldData(contactId?: string, enabled = true) {
  return useQuery({
    queryKey: ["contact-pco-field-data", contactId],
    enabled: !!contactId && enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ContactPcoFieldData> => {
      const { data, error } = await supabase.functions.invoke(
        "pco-fetch-contact-field-data",
        { body: { contact_id: contactId } }
      );
      if (error) throw error;
      return data as ContactPcoFieldData;
    },
  });
}
