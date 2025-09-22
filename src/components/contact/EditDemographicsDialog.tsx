import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";

interface Address {
  id?: string;
  address_type: string;
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  is_primary: boolean;
}

interface FamilyMember {
  id?: string;
  name: string;
  relationship: string;
  birthday?: string;
  notes?: string;
}

interface Demographics {
  birthday?: string;
  marital_status?: string;
  occupation?: string;
}

interface EditDemographicsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  demographics?: Demographics;
  addresses?: Address[];
  familyMembers?: FamilyMember[];
  onSave: () => void;
}

export const EditDemographicsDialog: React.FC<EditDemographicsDialogProps> = ({
  open,
  onOpenChange,
  contactId,
  demographics,
  addresses = [],
  familyMembers = [],
  onSave,
}) => {
  const [formData, setFormData] = useState<Demographics>({
    birthday: "",
    marital_status: "",
    occupation: "",
  });
  
  const [addressList, setAddressList] = useState<Address[]>([]);
  const [familyList, setFamilyList] = useState<FamilyMember[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (demographics) {
      setFormData({
        birthday: demographics.birthday || "",
        marital_status: demographics.marital_status || "",
        occupation: demographics.occupation || "",
      });
    }
    setAddressList(addresses.length > 0 ? addresses : [{
      address_type: "home",
      street_address: "",
      city: "",
      state: "",
      zip_code: "",
      country: "US",
      is_primary: true,
    }]);
    setFamilyList(familyMembers.length > 0 ? familyMembers : []);
  }, [demographics, addresses, familyMembers]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save demographics
      const { error: demoError } = await supabase
        .from("contact_demographics")
        .upsert({
          contact_id: contactId,
          birthday: formData.birthday || null,
          marital_status: formData.marital_status || null,
          occupation: formData.occupation || null,
        });

      if (demoError) throw demoError;

      // Save addresses
      for (const address of addressList) {
        if (address.street_address || address.city) {
          const { error: addrError } = await supabase
            .from("contact_addresses")
            .upsert({
              id: address.id,
              contact_id: contactId,
              ...address,
            });
          if (addrError) throw addrError;
        }
      }

      // Save family members
      for (const family of familyList) {
        if (family.name && family.relationship) {
          const { error: familyError } = await supabase
            .from("contact_family_members")
            .upsert({
              id: family.id,
              contact_id: contactId,
              ...family,
            });
          if (familyError) throw familyError;
        }
      }

      toast({ title: "Demographics updated successfully" });
      onSave();
      onOpenChange(false);
    } catch (error) {
      toast({ title: "Error updating demographics", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const addAddress = () => {
    setAddressList([...addressList, {
      address_type: "home",
      street_address: "",
      city: "",
      state: "",
      zip_code: "",
      country: "US",
      is_primary: false,
    }]);
  };

  const removeAddress = (index: number) => {
    setAddressList(addressList.filter((_, i) => i !== index));
  };

  const addFamilyMember = () => {
    setFamilyList([...familyList, {
      name: "",
      relationship: "",
      birthday: "",
      notes: "",
    }]);
  };

  const removeFamilyMember = (index: number) => {
    setFamilyList(familyList.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Demographics</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Demographics */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Personal Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="birthday">Birthday</Label>
                <Input
                  id="birthday"
                  type="date"
                  value={formData.birthday}
                  onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="marital_status">Marital Status</Label>
                <Select value={formData.marital_status} onValueChange={(value) => setFormData({ ...formData, marital_status: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single</SelectItem>
                    <SelectItem value="married">Married</SelectItem>
                    <SelectItem value="divorced">Divorced</SelectItem>
                    <SelectItem value="widowed">Widowed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="occupation">Occupation</Label>
              <Input
                id="occupation"
                value={formData.occupation}
                onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                placeholder="Enter occupation"
              />
            </div>
          </div>

          {/* Addresses */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Addresses</h3>
              <Button type="button" variant="outline" size="sm" onClick={addAddress}>
                <Plus className="h-4 w-4 mr-2" />
                Add Address
              </Button>
            </div>
            {addressList.map((address, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Select value={address.address_type} onValueChange={(value) => {
                    const updated = [...addressList];
                    updated[index].address_type = value;
                    setAddressList(updated);
                  }}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="home">Home</SelectItem>
                      <SelectItem value="work">Work</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeAddress(index)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <Input
                  placeholder="Street Address"
                  value={address.street_address}
                  onChange={(e) => {
                    const updated = [...addressList];
                    updated[index].street_address = e.target.value;
                    setAddressList(updated);
                  }}
                />
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    placeholder="City"
                    value={address.city}
                    onChange={(e) => {
                      const updated = [...addressList];
                      updated[index].city = e.target.value;
                      setAddressList(updated);
                    }}
                  />
                  <Input
                    placeholder="State"
                    value={address.state}
                    onChange={(e) => {
                      const updated = [...addressList];
                      updated[index].state = e.target.value;
                      setAddressList(updated);
                    }}
                  />
                  <Input
                    placeholder="ZIP"
                    value={address.zip_code}
                    onChange={(e) => {
                      const updated = [...addressList];
                      updated[index].zip_code = e.target.value;
                      setAddressList(updated);
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Family Members */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Family Members</h3>
              <Button type="button" variant="outline" size="sm" onClick={addFamilyMember}>
                <Plus className="h-4 w-4 mr-2" />
                Add Family Member
              </Button>
            </div>
            {familyList.map((family, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="grid grid-cols-2 gap-2 flex-1">
                    <Input
                      placeholder="Name"
                      value={family.name}
                      onChange={(e) => {
                        const updated = [...familyList];
                        updated[index].name = e.target.value;
                        setFamilyList(updated);
                      }}
                    />
                    <Input
                      placeholder="Relationship"
                      value={family.relationship}
                      onChange={(e) => {
                        const updated = [...familyList];
                        updated[index].relationship = e.target.value;
                        setFamilyList(updated);
                      }}
                    />
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeFamilyMember(index)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <Input
                  type="date"
                  placeholder="Birthday"
                  value={family.birthday || ""}
                  onChange={(e) => {
                    const updated = [...familyList];
                    updated[index].birthday = e.target.value;
                    setFamilyList(updated);
                  }}
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};