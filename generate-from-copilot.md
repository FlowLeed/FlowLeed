# Builder.io Visual Copilot Integration

## Next Steps

1. **Run the Visual Copilot command in your terminal:**
   ```bash
   npx "@builder.io/dev-tools@latest" code --url vcp://quickcopy/vcp-e92f22505cad4b8195e5c22f9576ed09 --spaceId f79f51d17d3a44f5af10f6b2af8e0e2f
   ```

2. This will generate React components based on your Visual Copilot design.

3. Once generated, integrate the components into your existing pages:
   - Replace Dashboard with Builder.io generated dashboard component
   - Enhance PipelineView with new design while keeping functionality
   - Update ContactCard with new visual design

## Configuration Complete

- ✅ Builder.io dependencies installed
- ✅ Builder.io SDK initialized with your space ID
- ✅ BuilderComponent wrapper created
- ✅ Ready for Visual Copilot integration

## Usage Example

```tsx
import { BuilderComponent } from '@/components/builder/BuilderComponent';

// Use in your components
<BuilderComponent modelName="dashboard" />
```