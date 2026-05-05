import { Link, useLocation } from 'react-router-dom';
import { Box, Flex, Stack, Icon, Text, Heading } from '@chakra-ui/react';
import {
  LayoutDashboard,
  MessageSquare,
  FileUp,
  Network,
  Zap,
  BrainCircuit,
  Brain,
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'My Brains', icon: Brain, path: '/brains' },
  { label: 'Documents', icon: FileUp, path: '/documents' },
  { label: 'Research Chat', icon: MessageSquare, path: '/chat' },
  { label: 'Ingest Docs', icon: FileUp, path: '/ingest' },
  { label: 'Knowledge Graph', icon: Network, path: '/graph' },
  { label: 'Self Healing', icon: Zap, path: '/self-healing' },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <Box
      w='64'
      bg='slate.950'
      borderRight='1px'
      borderColor='slate.800'
      h='full'
      display={{ base: 'none', lg: 'block' }}
    >
      <Flex direction='column' h='full' p='6'>
        <Flex align='center' gap='3' mb='10'>
          <Icon as={BrainCircuit} h='8' w='8' color='brand.500' />
          <Heading
            size='md'
            color='white'
            fontWeight='bold'
            letterSpacing='tight'
          >
            Knowledge
            <Text as='span' color='brand.500'>
              Brain
            </Text>
          </Heading>
        </Flex>

        <Stack gap='2' flex='1'>
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}>
                <Flex
                  align='center'
                  gap='3'
                  px='4'
                  py='3'
                  borderRadius='lg'
                  transition='all 0.2s'
                  bg={isActive ? 'brand.900/40' : 'transparent'}
                  color={isActive ? 'brand.400' : 'slate.400'}
                  _hover={{
                    bg: isActive ? 'brand.900/40' : 'slate.900',
                    color: isActive ? 'brand.400' : 'white',
                  }}
                >
                  <Icon as={item.icon} h='5' w='5' />
                  <Text
                    fontSize='sm'
                    fontWeight={isActive ? 'semibold' : 'medium'}
                  >
                    {item.label}
                  </Text>
                </Flex>
              </Link>
            );
          })}
        </Stack>
      </Flex>
    </Box>
  );
}
