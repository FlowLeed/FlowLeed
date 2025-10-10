import React, { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Settings, Tag, Search, Pencil, Trash2, GitMerge } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useOrgTagManagement } from "@/hooks/useOrgTagManagement";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const OrganizationSettingsPage = () => {
  const { organization } = useProfile();
  const { tagStats, isLoading, renameTag, deleteTag, mergeTags } = useOrgTagManagement(organization?.id);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<string | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [tagToRename, setTagToRename] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [selectedTagsForMerge, setSelectedTagsForMerge] = useState<string[]>([]);
  const [mergeTargetTag, setMergeTargetTag] = useState("");

  const filteredTags = tagStats.filter(({ tag }) =>
    tag.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDeleteClick = (tag: string) => {
    setTagToDelete(tag);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (tagToDelete) {
      deleteTag(tagToDelete);
      setDeleteDialogOpen(false);
      setTagToDelete(null);
    }
  };

  const handleRenameClick = (tag: string) => {
    setTagToRename(tag);
    setNewTagName(tag);
    setRenameDialogOpen(true);
  };

  const handleRenameConfirm = () => {
    if (tagToRename && newTagName && newTagName !== tagToRename) {
      renameTag({ oldTag: tagToRename, newTag: newTagName });
      setRenameDialogOpen(false);
      setTagToRename(null);
      setNewTagName("");
    }
  };

  const toggleTagForMerge = (tag: string) => {
    setSelectedTagsForMerge(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleMergeClick = () => {
    if (selectedTagsForMerge.length < 2) {
      return;
    }
    setMergeTargetTag(selectedTagsForMerge[0]);
    setMergeDialogOpen(true);
  };

  const handleMergeConfirm = () => {
    if (selectedTagsForMerge.length >= 2 && mergeTargetTag) {
      mergeTags({ sourceTags: selectedTagsForMerge, targetTag: mergeTargetTag });
      setMergeDialogOpen(false);
      setSelectedTagsForMerge([]);
      setMergeTargetTag("");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Organization Settings" />
      
      <div className="flex-1 overflow-auto p-6">
        <Tabs defaultValue="tags" className="w-full">
          <TabsList>
            <TabsTrigger value="general">
              <Settings className="h-4 w-4 mr-2" />
              General
            </TabsTrigger>
            <TabsTrigger value="tags">
              <Tag className="h-4 w-4 mr-2" />
              Tag Management
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Organization Details</CardTitle>
                <CardDescription>Basic information about your organization</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="org-name">Organization Name</Label>
                  <Input id="org-name" value={organization?.name || ""} disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-slug">Organization Slug</Label>
                  <Input id="org-slug" value={organization?.slug || ""} disabled />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tags" className="space-y-4 mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Tag className="h-5 w-5" />
                      Tag Management
                    </CardTitle>
                    <CardDescription>
                      Manage tags across your organization ({tagStats.length} unique tags)
                    </CardDescription>
                  </div>
                  {selectedTagsForMerge.length >= 2 && (
                    <Button onClick={handleMergeClick} variant="outline" className="gap-2">
                      <GitMerge className="h-4 w-4" />
                      Merge {selectedTagsForMerge.length} Tags
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search tags..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Select</TableHead>
                        <TableHead>Tag Name</TableHead>
                        <TableHead>Contacts Using</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTags.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                            No tags found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredTags.map(({ tag, count }) => (
                          <TableRow key={tag}>
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={selectedTagsForMerge.includes(tag)}
                                onChange={() => toggleTagForMerge(tag)}
                                className="cursor-pointer"
                              />
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{tag}</Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {count} {count === 1 ? 'contact' : 'contacts'}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRenameClick(tag)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteClick(tag)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tag</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the tag "{tagToDelete}"? This will remove it from all contacts in your organization. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Tag</DialogTitle>
            <DialogDescription>
              Enter a new name for the tag "{tagToRename}". This will update the tag for all contacts using it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-tag-name">New Tag Name</Label>
              <Input
                id="new-tag-name"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Enter new tag name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRenameConfirm} disabled={!newTagName || newTagName === tagToRename}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge Tags Dialog */}
      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge Tags</DialogTitle>
            <DialogDescription>
              Merge {selectedTagsForMerge.length} tags into one. All selected tags will be replaced with the target tag name.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Selected Tags</Label>
              <div className="flex flex-wrap gap-2">
                {selectedTagsForMerge.map(tag => (
                  <Badge key={tag} variant="secondary">{tag}</Badge>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="merge-target">Target Tag Name</Label>
              <Input
                id="merge-target"
                value={mergeTargetTag}
                onChange={(e) => setMergeTargetTag(e.target.value)}
                placeholder="Enter target tag name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleMergeConfirm} disabled={!mergeTargetTag}>
              Merge Tags
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrganizationSettingsPage;
