import { PropsWithChildren, useEffect, useState } from 'react';
import { Flex, Box } from '@chakra-ui/react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'knowledge-brain.sidebar-collapsed';

export function AppShell({ children }: PropsWithChildren) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    const storedValue = window.localStorage.getItem(
      SIDEBAR_COLLAPSED_STORAGE_KEY,
    );
    setIsSidebarCollapsed(storedValue === 'true');
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      SIDEBAR_COLLAPSED_STORAGE_KEY,
      String(isSidebarCollapsed),
    );
  }, [isSidebarCollapsed]);

  return (
    <Flex h='100dvh' overflow='hidden' bg='bg' color='fg'>
      <Sidebar
        collapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((value) => !value)}
      />
      <Flex direction='column' flex='1' minW='0' overflow='hidden'>
        <Topbar />
        <Box as='main' flex='1' minH='0' overflow='hidden' minW='0'>
          <Box h='full' minH='0'>
            {children}
          </Box>
        </Box>
      </Flex>
    </Flex>
  );
}
