# Employee Workspaces

## Overview

Employee Workspaces provide a dedicated interface for each agent (employee) in your AI company to manage their tasks, view notifications, handle approvals, and track their activity.

## Features

### Employee Portal (`/employees`)

The Employee Portal is the main landing page for all employee workspaces. It provides:

- **Team Overview**: See all agents (employees) in your organization
- **Org Chart Visualization**: Hierarchical view showing reporting relationships
- **Quick Stats**: At-a-glance view of active tasks, pending work, and approvals per employee
- **Direct Access**: Quick links to each employee's workspace and detail pages

### Individual Workspace (`/agents/:agentId/workspace`)

Each employee has a dedicated workspace with the following tabs:

#### 1. Inbox
- Notifications about task assignments
- Approval requests waiting for action
- Task completion/failure notifications
- Sorted by priority and read status

#### 2. My Tasks
- **In Progress**: Tasks currently being worked on
- **Blocked**: Tasks waiting on dependencies
- **Pending**: Tasks in todo/backlog status
- **Recently Completed**: Last 5 completed tasks

#### 3. Approvals
- Pending approvals that need human decision
- Approval type and request timestamp
- Direct link to review and approve/reject

#### 4. Activity
- Recent actions taken by the agent
- Task status changes
- Audit trail of agent operations

#### 5. Skills
- Company skills available to the agent
- Skill descriptions and capabilities
- Configuration status

#### 6. Settings
- Agent profile information
- Permissions overview
- Adapter configuration details

## Navigation

### Accessing the Employee Portal

1. Click **Employees** in the left sidebar (under "Work" section)
2. Or navigate directly to `/employees`

### Accessing Individual Workspaces

From the Employee Portal:
1. Find the employee in the org chart
2. Click the **Workspace** button on their card

From the Agent Detail page:
1. Navigate to an agent's detail page (`/agents/:agentId`)
2. Click the **Workspace** button in the header

From the Sidebar:
1. Expand the **Agents** section
2. Click on an agent
3. Click **Workspace** in the agent's detail page

## API Endpoints

The employee workspace feature uses the following API endpoints:

### Agent-Specific Endpoints

```
GET /api/agents/me                    # Get current agent details
GET /api/agents/me/inbox-lite         # Get simplified inbox for agent
GET /api/agents/me/inbox/mine         # Get inbox items for agent
```

### Company-Scoped Endpoints

```
GET /api/agents                       # List all agents in company
GET /api/issues                       # List all issues in company
GET /api/approvals                    # List all approvals in company
GET /api/heartbeats/:agentId          # Get agent heartbeat runs
GET /api/activity                     # Get activity events
GET /api/company-skills               # List company skills
```

## Adding New Employees

When you create a new agent in Paperclip, their workspace is automatically available:

1. Navigate to **Agents** > **New Agent**
2. Fill in the agent details (name, role, title, etc.)
3. Save the agent
4. The workspace is immediately accessible at `/agents/:agentId/workspace`

No additional configuration is needed - the workspace is created by default.

## Design Principles

The Employee Workspace UI follows these design principles:

1. **Agent-Centric**: All information is scoped to the individual agent
2. **Action-Oriented**: Quick access to common actions (start task, approve, etc.)
3. **Status Visibility**: Clear indicators for task status, agent status, and pending items
4. **Hierarchical Organization**: Org chart reflects company structure
5. **Dark Theme**: Modern, professional dark mode interface

## Technical Implementation

### Components

- `Employees.tsx` - Main portal page with org chart
- `AgentWorkspace.tsx` - Individual workspace with tabs
- `Sidebar.tsx` - Navigation with Employees link

### Routes

```typescript
<Route path="employees" element={<Employees />} />
<Route path="agents/:agentId/workspace" element={<AgentWorkspace />} />
```

### Data Flow

1. **Employee Portal** fetches all agents and computes stats
2. **Agent Workspace** fetches agent-specific data:
   - Assigned issues
   - Pending approvals
   - Recent runs
   - Activity events
   - Company skills

## Best Practices

1. **Use URL Keys**: Agents can be referenced by URL key (e.g., `ceo`, `cto`) or UUID
2. **Company Context**: Always ensure company context is available when fetching agent data
3. **Status Indicators**: Use status badges to show agent health (active, paused, error)
4. **Permission Checks**: Respect agent permissions in the UI
5. **Responsive Design**: workspace works on desktop and mobile

## Troubleshooting

### Workspace shows blank page

- Check that company is selected
- Verify agent exists and is accessible
- Check browser console for errors

### Stats not updating

- Refresh the page
- Check API connectivity
- Verify agent has assigned tasks

### Missing workspace link

- Ensure you're on an agent detail page
- Check that agent is properly configured

## Future Enhancements

Potential improvements for employee workspaces:

- [ ] Custom dashboard widgets per employee
- [ ] Drag-and-drop task management
- [ ] Advanced filtering and search
- [ ] Export/import workspace configuration
- [ ] Collaborative features (comments, mentions)
- [ ] Time tracking and productivity metrics
- [ ] Custom notifications and alerts
