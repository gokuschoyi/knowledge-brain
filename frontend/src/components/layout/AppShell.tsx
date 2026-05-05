import { PropsWithChildren } from 'react';
import { Flex, Box } from '@chakra-ui/react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppShell({ children }: PropsWithChildren) {
  return (
    <Flex h='100dvh' overflow='hidden' bg='bg' color='fg'>
      <Sidebar />
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
