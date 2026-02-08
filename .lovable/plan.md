

## Add Share Signup Link Button to Group Detail Page

### Overview

Add a prominent "Share Link" button on the Group Detail page header so group leaders can quickly copy and share the public signup link without having to open the Edit dialog.

---

### Change

**File:** `src/pages/GroupDetailPage.tsx`

Add a "Share Link" button in the header next to "Signup Requests" when public signup is enabled and a token exists.

#### 1. Add new imports

```typescript
import { Share2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
```

#### 2. Add state and helper function

```typescript
const { toast } = useToast();
const [linkCopied, setLinkCopied] = useState(false);

const copySignupLink = async () => {
  if (!group?.public_signup_token) return;
  const link = `${window.location.origin}/groups/join/${group.public_signup_token}`;
  
  try {
    await navigator.clipboard.writeText(link);
    setLinkCopied(true);
    toast({
      title: "Link copied!",
      description: "Public signup link copied to clipboard",
    });
    setTimeout(() => setLinkCopied(false), 2000);
  } catch (err) {
    toast({
      title: "Failed to copy",
      description: "Please try again",
      variant: "destructive",
    });
  }
};
```

#### 3. Add button in header (lines 93-114)

Add a new button before "Signup Requests":

```tsx
<div className="flex items-center gap-2">
  {group.allow_public_signup && group.public_signup_token && (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={copySignupLink}
    >
      {linkCopied ? (
        <Check className="h-4 w-4 mr-2" />
      ) : (
        <Share2 className="h-4 w-4 mr-2" />
      )}
      {linkCopied ? "Copied!" : "Share Link"}
    </Button>
  )}
  {group.allow_public_signup && (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={() => setSignupRequestsOpen(true)}
      className="relative"
    >
      ...existing signup requests button...
    </Button>
  )}
  <Button variant="outline" size="sm" onClick={() => setEditGroupOpen(true)}>
    <Settings className="h-4 w-4 mr-2" />
    Edit Group
  </Button>
</div>
```

---

### Behavior

| Condition | Button Shows |
|-----------|--------------|
| `allow_public_signup = false` | Hidden |
| `allow_public_signup = true` but no token | Hidden |
| `allow_public_signup = true` with token | Shows "Share Link" button |
| After click | Changes to "Copied!" with checkmark for 2 seconds |

---

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/GroupDetailPage.tsx` | Add Share2/Check icons, toast hook, linkCopied state, copySignupLink function, and Share Link button |

---

### Result

Group leaders will see a "Share Link" button in the header that instantly copies the public signup link to their clipboard, making it easy to share via text, email, or social media.

