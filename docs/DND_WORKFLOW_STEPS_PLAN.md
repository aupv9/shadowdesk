# Drag & Drop Workflow Steps — Planning & Architecture

**Status**: Planning Phase  
**Date**: 2026-04-08  
**Priority**: Medium (Nice-to-have UX improvement)

---

## 1. Problem Statement

### Current Experience
- Users can only reorder steps using Move Up/Move Down buttons
- This is slow for large workflows (20+ steps)
- Tedious for reorganizing multiple steps
- No visual feedback during reordering

### Desired Experience
- Drag steps directly to new positions
- See visual feedback (hover states, drop zones)
- Smooth animations
- Works on touch and desktop

---

## 2. UI/UX Design

### Current State (Buttons)
```
┌─────────────────────────────────────────┐
│ Step 1: Navigate                        │
│ [↑] [↓] [⋯] [Delete]                   │
├─────────────────────────────────────────┤
│ Step 2: Click Button                    │
│ [↑] [↓] [⋯] [Delete]                   │
├─────────────────────────────────────────┤
│ Step 3: Extract Text                    │
│ [↑] [↓] [⋯] [Delete]                   │
└─────────────────────────────────────────┘
```

### With Drag & Drop (Enhanced)
```
┌─────────────────────────────────────────┐
│ ⋮⋮ Step 1: Navigate                     │ ← Drag handle
│    [↑] [↓] [⋯] [Delete]                │
├─────────────────────────────────────────┤
│ ⋮⋮ Step 2: Click Button [DRAGGING]     │ ← Visual feedback
│    [↑] [↓] [⋯] [Delete]                │
├─────────────────────────────────────────┤
│ ⋮⋮ Step 3: Extract Text                 │
│    [↑] [↓] [⋯] [Delete]                │
│    ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬                │ ← Drop zone indicator
├─────────────────────────────────────────┤
└─────────────────────────────────────────┘
```

### Drag Handle Design
```
Visual Indicator:
┌─────────────┐
│ ⋮⋮ Step 1   │ ← 6-dot drag handle (⋮⋮)
│    Navigate │    Shows: draggable
│             │    Cursor: grab → grabbing on drag
└─────────────┘

States:
- Default: ⋮⋮ (light gray, opacity 0.5)
- Hover: ⋮⋮ (light gray, opacity 1.0, cursor: grab)
- Dragging: ⋮⋮ (white, opacity 1.0, cursor: grabbing)
- Over drop zone: ⋮⋮ (highlight color)
```

### Drop Zone Indicator
```
Before drag:
┌─────────────────────────────────────────┐
│ Step 1                                  │
├─────────────────────────────────────────┤
│ Step 2 [DRAGGING]                       │
├─────────────────────────────────────────┤  ← Between steps
│ Step 3                                  │
└─────────────────────────────────────────┘

During drag (over Step 3):
┌─────────────────────────────────────────┐
│ Step 1                                  │
├─────────────────────────────────────────┤
│ Step 2 [DRAGGING]                       │
├─────────────────────────────────────────┤
│ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬                   │  ← Blue drop zone
│ Step 3                                  │
└─────────────────────────────────────────┘
```

---

## 3. Technical Architecture

### Libraries & Approach
- **React Native DnD**: `react-beautiful-dnd` (recommended)
  - Pros: Accessible, animations, touch-friendly, no CSS rewrite
  - Cons: Extra dependency (4KB)
  
- **HTML5 Drag & Drop**: Native API (alternative)
  - Pros: No dependencies, built-in
  - Cons: Poor touch support, more verbose
  
- **Headless DnD**: `@dnd-kit` (best)
  - Pros: Headless, customizable, modern, touch-friendly
  - Cons: Requires more setup

**Decision**: Use HTML5 Drag & Drop API with manual touch handling
- Keeps dependencies minimal
- Full control over styling
- Works well with Tailwind CSS

### Component Structure

```
StepEditor (existing component)
├── DragHandle (NEW)
│   └── Shows ⋮⋮ icon, manages drag state
└── DropZone (NEW)
    └── Visual indicator when dragging over

WorkflowStepList (parent)
├── onReorderSteps(fromIndex, toIndex) ← NEW handler
└── Uses StepEditor[] with DnD enabled
```

### State Management

**Zustand Store Update** (automationStore)
```typescript
interface AutomationStore {
  // Existing:
  workflows: Workflow[]
  
  // NEW:
  draggedStepIndex: number | null  // Index of step being dragged
  dropIndex: number | null         // Index where drop will occur
  
  // Actions:
  reorderSteps: (workflowId, fromIndex, toIndex) => void
  setDraggedStep: (index) => void
  setDropIndex: (index) => void
}
```

### Event Flow

```
1. User clicks ⋮⋮ handle
   └─> dragstart event
       ├─> Set draggedStepIndex
       └─> Show drag opacity (0.5)

2. User drags over drop zone
   └─> dragover event
       ├─> Set dropIndex
       └─> Show drop zone highlight

3. User releases mouse
   └─> drop event
       ├─> Call reorderSteps(fromIndex, dropIndex)
       ├─> Update workflow.steps
       └─> Clear drag state

4. dragend event
   └─> Clear draggedStepIndex, dropIndex
```

---

## 4. Implementation Plan

### Phase 1: DragHandle Component (30 min)
- [ ] Create DragHandle.tsx component
  - Show ⋮⋮ icon
  - Manage drag state
  - Hover/drag styling
- [ ] Add to StepEditor header

### Phase 2: Drop Zone Indicator (20 min)
- [ ] Add visual drop zone between steps
- [ ] Show on dragover
- [ ] Remove on dragleave

### Phase 3: Reorder Logic (20 min)
- [ ] Implement onDrop handler
- [ ] Call onReorder callback
- [ ] Update workflow step order
- [ ] Clear drag state

### Phase 4: Testing & Polish (30 min)
- [ ] Test basic drag-drop
- [ ] Test edge cases (last step, first step)
- [ ] Test touch (if using native DnD)
- [ ] Animations (smooth drop)

**Total**: ~1.5 hours

---

## 5. Implementation Details

### DragHandle Component

```typescript
interface DragHandleProps {
  index: number
  isDragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
}

export function DragHandle({ index, isDragging, onDragStart, onDragEnd }: DragHandleProps) {
  return (
    <button
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`
        cursor-grab active:cursor-grabbing
        text-slate-600 hover:text-slate-400
        ${isDragging ? 'opacity-100' : 'opacity-50'}
      `}
      title="Drag to reorder"
    >
      ⋮⋮
    </button>
  )
}
```

### Drop Zone

```typescript
function DropZone({ isActive, position }: { isActive: boolean; position: 'before' | 'after' }) {
  return isActive ? (
    <div className="h-1 bg-ghost-500 rounded my-1" />
  ) : null
}
```

### StepEditor Changes

```typescript
// Before:
<span className="text-xs font-mono text-slate-600 w-5 text-right">
  {index + 1}
</span>

// After:
<DragHandle
  index={index}
  isDragging={draggedStepIndex === index}
  onDragStart={() => handleDragStart(index)}
  onDragEnd={handleDragEnd}
/>
```

---

## 6. User Stories

### Story 1: Reorder Adjacent Steps
```
Given: Workflow with 3 steps
When: User drags Step 2 down to position 3
Then: Steps reorder to [1, 3, 2]
  And: No errors
  And: Smooth animation
```

### Story 2: Reorder Non-Adjacent Steps
```
Given: Workflow with 5 steps
When: User drags Step 1 to position 5
Then: Steps reorder to [2, 3, 4, 5, 1]
  And: All steps are visible
```

### Story 3: Cancel Drag
```
Given: User is dragging Step 2
When: User releases outside any step
Then: Step returns to original position
  And: No changes saved
```

---

## 7. Browser & Accessibility Support

### Browser Compatibility
- ✅ Chrome/Edge: Full support
- ✅ Firefox: Full support
- ✅ Safari: Full support
- ⚠️ Touch devices: Native drag-drop is limited

### Accessibility
- Keep ↑↓ buttons as fallback
- Drag handle has `draggable` attribute
- Announce drag state to screen readers
- Keyboard support via buttons (not drag)

---

## 8. Alternative: Keyboard Shortcuts

For accessibility, consider keyboard shortcuts:
```
Alt+↑ : Move step up
Alt+↓ : Move step down
```

Could be added in Phase 2.

---

## 9. Success Criteria

- [ ] Drag handle visible on all steps
- [ ] Dragging a step shows visual feedback
- [ ] Drop zone indicator shows during drag
- [ ] Drop reorders steps correctly
- [ ] Up/Down buttons still work
- [ ] No console errors
- [ ] Smooth animations
- [ ] Works on desktop browsers
- [ ] Touch support (optional for Phase 1)

---

## 10. Files to Create/Modify

### New Files
- `src/renderer/src/components/AutomationBuilder/DragHandle.tsx`

### Modified Files
- `src/renderer/src/components/AutomationBuilder/StepEditor.tsx`
- `src/renderer/src/components/AutomationBuilder/index.tsx` (if parent manages reorder)

---

## 11. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Drag events not firing | High | Test on multiple browsers |
| Touch not working | Medium | Keep button fallback |
| Performance (large workflows) | Low | Drag-drop is lightweight |
| Accessibility issues | Medium | Keep keyboard shortcuts, ARIA labels |

---

## 12. Future Enhancements

- Drag steps into nested groups/conditionals
- Multi-select & bulk move
- Undo/redo support
- Keyboard shortcuts for reorder
- Touch gesture support
- Animated drop feedback
