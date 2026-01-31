'use client';

import * as React from 'react';
import {
  Button,
  Input,
  Label,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
  Avatar,
  AvatarImage,
  AvatarFallback,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Separator,
  Skeleton,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Popover,
  PopoverTrigger,
  PopoverContent,
  ScrollArea,
} from '@/components/ui';

import {
  EmptyState,
  ConfirmDialog,
  SearchInput,
  LoadingOverlay,
  Spinner,
} from '@/components/common';

import { toast } from 'sonner';
import {
  Box,
  ChevronDown,
  Inbox,
  Mail,
  Settings,
  User,
  Plus,
  Trash2,
  Edit,
  MoreHorizontal,
} from 'lucide-react';

export default function ShowcasePage() {
  const [searchValue, setSearchValue] = React.useState('');
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [showLoading, setShowLoading] = React.useState(false);

  const handleShowLoading = () => {
    setShowLoading(true);
    setTimeout(() => setShowLoading(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      {showLoading && <LoadingOverlay message="Loading demo..." />}

      <div className="mx-auto max-w-6xl">
        <header className="mb-12 text-center">
          <div className="mb-4 flex items-center justify-center gap-2">
            <Box className="h-10 w-10 text-primary" />
            <h1 className="text-4xl font-bold">GlassBox Component Library</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Frosted glass design system built on Shadcn/ui
          </p>
        </header>

        <div className="space-y-12">
          {/* Buttons */}
          <Section title="Buttons" description="Button variants including glass effects">
            <div className="flex flex-wrap gap-4">
              <Button>Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="link">Link</Button>
              <Button variant="glass">Glass</Button>
              <Button variant="glass-primary">Glass Primary</Button>
            </div>
            <div className="mt-4 flex flex-wrap gap-4">
              <Button size="sm">Small</Button>
              <Button size="default">Default</Button>
              <Button size="lg">Large</Button>
              <Button size="icon"><Plus className="h-4 w-4" /></Button>
            </div>
          </Section>

          {/* Form Inputs */}
          <Section title="Form Inputs" description="Input components with labels">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="Enter your email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" placeholder="Enter password" />
              </div>
              <div className="space-y-2">
                <Label>Select</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="option1">Option 1</SelectItem>
                    <SelectItem value="option2">Option 2</SelectItem>
                    <SelectItem value="option3">Option 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Search</Label>
                <SearchInput
                  value={searchValue}
                  onChange={setSearchValue}
                  placeholder="Search..."
                />
              </div>
            </div>
          </Section>

          {/* Cards */}
          <Section title="Cards" description="Card components with glass variants">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Default Card</CardTitle>
                  <CardDescription>Standard card with shadow</CardDescription>
                </CardHeader>
                <CardContent>
                  <p>This is a standard card component.</p>
                </CardContent>
                <CardFooter>
                  <Button size="sm">Action</Button>
                </CardFooter>
              </Card>

              <Card variant="glass">
                <CardHeader>
                  <CardTitle>Glass Card</CardTitle>
                  <CardDescription>Frosted glass effect</CardDescription>
                </CardHeader>
                <CardContent>
                  <p>This card has a glass/frosted effect.</p>
                </CardContent>
                <CardFooter>
                  <Button size="sm" variant="glass">Action</Button>
                </CardFooter>
              </Card>
            </div>
          </Section>

          {/* Glass Effects Demo */}
          <Section title="Glass Effects" description="Various glass utilities">
            <div className="grid gap-6 md:grid-cols-4">
              <div className="glass rounded-lg p-6 text-center">
                <p className="font-medium">.glass</p>
                <p className="text-sm text-muted-foreground">Standard</p>
              </div>
              <div className="glass-subtle rounded-lg p-6 text-center">
                <p className="font-medium">.glass-subtle</p>
                <p className="text-sm text-muted-foreground">Subtle</p>
              </div>
              <div className="glass-strong rounded-lg p-6 text-center">
                <p className="font-medium">.glass-strong</p>
                <p className="text-sm text-muted-foreground">Strong</p>
              </div>
              <div className="glass-card rounded-lg p-6 text-center">
                <p className="font-medium">.glass-card</p>
                <p className="text-sm text-muted-foreground">Card</p>
              </div>
            </div>
          </Section>

          {/* Badges */}
          <Section title="Badges" description="Status indicators and labels">
            <div className="flex flex-wrap gap-4">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="destructive">Destructive</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="success">Success</Badge>
              <Badge variant="warning">Warning</Badge>
              <Badge variant="error">Error</Badge>
              <Badge variant="info">Info</Badge>
              <Badge variant="glass">Glass</Badge>
            </div>
          </Section>

          {/* Avatars */}
          <Section title="Avatars" description="User avatars with fallbacks">
            <div className="flex items-center gap-4">
              <Avatar>
                <AvatarImage src="https://github.com/shadcn.png" alt="User" />
                <AvatarFallback>CN</AvatarFallback>
              </Avatar>
              <Avatar>
                <AvatarFallback>JD</AvatarFallback>
              </Avatar>
              <Avatar>
                <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
              </Avatar>
              <Avatar className="h-12 w-12">
                <AvatarFallback className="text-lg">AB</AvatarFallback>
              </Avatar>
            </div>
          </Section>

          {/* Dialogs */}
          <Section title="Dialogs" description="Modal dialogs with glass backdrop">
            <div className="flex gap-4">
              <Dialog>
                <DialogTrigger asChild>
                  <Button>Open Dialog</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Dialog Title</DialogTitle>
                    <DialogDescription>
                      This is a dialog with a frosted glass effect backdrop.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <p>Dialog content goes here.</p>
                  </div>
                  <DialogFooter>
                    <Button variant="outline">Cancel</Button>
                    <Button>Confirm</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
                Confirm Dialog
              </Button>
              <ConfirmDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                title="Delete Item"
                description="Are you sure you want to delete this item? This action cannot be undone."
                variant="destructive"
                confirmLabel="Delete"
                onConfirm={() => {
                  toast.success('Item deleted');
                  setConfirmOpen(false);
                }}
              />
            </div>
          </Section>

          {/* Dropdowns */}
          <Section title="Dropdowns" description="Dropdown menus and context menus">
            <div className="flex gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    Options <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <User className="mr-2 h-4 w-4" /> Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" /> Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Mail className="mr-2 h-4 w-4" /> Email
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem><Edit className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                  <DropdownMenuItem><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </Section>

          {/* Tabs */}
          <Section title="Tabs" description="Tab navigation component">
            <Tabs defaultValue="tab1" className="w-full max-w-md">
              <TabsList>
                <TabsTrigger value="tab1">Account</TabsTrigger>
                <TabsTrigger value="tab2">Password</TabsTrigger>
                <TabsTrigger value="tab3">Settings</TabsTrigger>
              </TabsList>
              <TabsContent value="tab1" className="mt-4">
                <Card>
                  <CardContent className="pt-6">
                    Account settings and information.
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="tab2" className="mt-4">
                <Card>
                  <CardContent className="pt-6">
                    Password and security settings.
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="tab3" className="mt-4">
                <Card>
                  <CardContent className="pt-6">
                    General application settings.
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </Section>

          {/* Tooltips & Popovers */}
          <Section title="Tooltips & Popovers" description="Contextual information">
            <div className="flex gap-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline">Hover me</Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>This is a tooltip</p>
                </TooltipContent>
              </Tooltip>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline">Click me</Button>
                </PopoverTrigger>
                <PopoverContent>
                  <div className="space-y-2">
                    <h4 className="font-medium">Popover Content</h4>
                    <p className="text-sm text-muted-foreground">
                      This is a popover with more content.
                    </p>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </Section>

          {/* Loading States */}
          <Section title="Loading States" description="Skeletons and spinners">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Skeletons</h4>
                <div className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-[250px]" />
                    <Skeleton className="h-4 w-[200px]" />
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Spinners</h4>
                <div className="flex items-center gap-4">
                  <Spinner size="sm" />
                  <Spinner size="md" />
                  <Spinner size="lg" />
                  <Button onClick={handleShowLoading}>Show Loading Overlay</Button>
                </div>
              </div>
            </div>
          </Section>

          {/* Empty State */}
          <Section title="Empty State" description="Placeholder for empty content">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardContent className="p-0">
                  <EmptyState
                    icon={Inbox}
                    title="No messages"
                    description="You don't have any messages yet."
                  />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-0">
                  <EmptyState
                    icon={Box}
                    title="No projects"
                    description="Create your first project to get started."
                    action={{
                      label: 'Create Project',
                      onClick: () => toast.success('Create project clicked'),
                    }}
                  />
                </CardContent>
              </Card>
            </div>
          </Section>

          {/* Toast Notifications */}
          <Section title="Toast Notifications" description="Sonner toast messages">
            <div className="flex flex-wrap gap-4">
              <Button onClick={() => toast.success('Success message!')}>
                Success Toast
              </Button>
              <Button onClick={() => toast.error('Error message!')}>
                Error Toast
              </Button>
              <Button onClick={() => toast.info('Info message!')}>
                Info Toast
              </Button>
              <Button onClick={() => toast.warning('Warning message!')}>
                Warning Toast
              </Button>
              <Button
                onClick={() =>
                  toast.promise(
                    new Promise((resolve) => setTimeout(resolve, 2000)),
                    {
                      loading: 'Loading...',
                      success: 'Done!',
                      error: 'Error!',
                    }
                  )
                }
              >
                Promise Toast
              </Button>
            </div>
          </Section>

          {/* Scroll Area */}
          <Section title="Scroll Area" description="Custom scrollbar container">
            <ScrollArea className="h-48 w-full rounded-md border">
              <div className="p-4">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div key={i} className="py-2 border-b last:border-0">
                    Scroll item {i + 1}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </Section>
        </div>

        <footer className="mt-16 text-center text-sm text-muted-foreground">
          <Separator className="mb-8" />
          <p>GlassBox v2 Component Library</p>
          <p className="mt-1">Built with Shadcn/ui, Radix, and Tailwind CSS</p>
        </footer>
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">{title}</h2>
        <p className="text-muted-foreground">{description}</p>
      </div>
      <div className="glass-card rounded-lg p-6">{children}</div>
    </section>
  );
}
