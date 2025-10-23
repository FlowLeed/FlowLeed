import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Phone, Plus, Trash2, UserCircle } from "lucide-react";
import { useTwilioNumbers } from "@/hooks/useTwilioNumbers";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";

export const TwilioConfigSection = () => {
  const { numbers, isLoading, provisionNumber, releaseNumber, assignNumber } =
    useTwilioNumbers();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [areaCode, setAreaCode] = useState("");
  const [friendlyName, setFriendlyName] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);

  const handleProvision = async () => {
    if (!areaCode || areaCode.length !== 3) {
      return;
    }
    await provisionNumber.mutateAsync({
      areaCode,
      friendlyName: friendlyName || undefined,
      isPrimary,
    });
    setIsDialogOpen(false);
    setAreaCode("");
    setFriendlyName("");
    setIsPrimary(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Twilio Phone Numbers</CardTitle>
            <CardDescription>
              Manage your organization's phone numbers for SMS and calls
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Provision Number
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Provision New Phone Number</DialogTitle>
                <DialogDescription>
                  Search for and purchase a new Twilio phone number
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="areaCode">Area Code</Label>
                  <Input
                    id="areaCode"
                    placeholder="e.g., 415"
                    value={areaCode}
                    onChange={(e) =>
                      setAreaCode(e.target.value.replace(/\D/g, "").slice(0, 3))
                    }
                    maxLength={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    3-digit area code for the phone number
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="friendlyName">Friendly Name (Optional)</Label>
                  <Input
                    id="friendlyName"
                    placeholder="e.g., Main Office Line"
                    value={friendlyName}
                    onChange={(e) => setFriendlyName(e.target.value)}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="isPrimary"
                    checked={isPrimary}
                    onCheckedChange={setIsPrimary}
                  />
                  <Label htmlFor="isPrimary">Set as primary number</Label>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={provisionNumber.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleProvision}
                  disabled={!areaCode || areaCode.length !== 3 || provisionNumber.isPending}
                >
                  {provisionNumber.isPending ? "Provisioning..." : "Provision"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading phone numbers...
          </div>
        ) : numbers.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="mb-4">No phone numbers provisioned yet</p>
            <p className="text-sm">
              Provision your first phone number to start sending SMS and making calls
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Phone Number</TableHead>
                <TableHead>Friendly Name</TableHead>
                <TableHead>Capabilities</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {numbers.map((number) => (
                <TableRow key={number.id}>
                  <TableCell className="font-medium">
                    {number.phone_number}
                    {number.is_primary && (
                      <Badge variant="secondary" className="ml-2">
                        Primary
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{number.friendly_name || "-"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {number.capabilities.voice && (
                        <Badge variant="outline">Voice</Badge>
                      )}
                      {number.capabilities.sms && (
                        <Badge variant="outline">SMS</Badge>
                      )}
                      {number.capabilities.mms && (
                        <Badge variant="outline">MMS</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        number.status === "active" ? "default" : "secondary"
                      }
                    >
                      {number.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {number.assigned_to_user_id ? (
                      <div className="flex items-center gap-2">
                        <UserCircle className="h-4 w-4" />
                        <span className="text-sm">Team Member</span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Unassigned
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => releaseNumber.mutate(number.id)}
                      disabled={releaseNumber.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};