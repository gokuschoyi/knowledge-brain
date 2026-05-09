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
      w='76'
      bg='rgba(3, 7, 18, 0.9)'
      borderRight='1px solid'
      borderColor='glassBorder'
      h='full'
      display={{ base: 'none', lg: 'block' }}
      position='relative'
      overflow='hidden'
      backdropFilter='blur(20px)'
    >
      <Box
        position='absolute'
        inset='0'
        bg='radial-gradient(circle at top left, rgba(99, 102, 241, 0.16), transparent 28%), radial-gradient(circle at bottom right, rgba(34, 211, 238, 0.1), transparent 22%)'
        pointerEvents='none'
      />
      <Flex direction='column' h='full' p='6' position='relative'>
        <Flex align='center' gap='4' mb='6' borderRadius='2xl' px='4'>
          <Flex
            align='center'
            justify='center'
            h='12'
            w='12'
            borderRadius='2xl'
            bg='linear-gradient(135deg, rgba(99, 102, 241, 0.24), rgba(34, 211, 238, 0.18))'
            boxShadow='0 0 0 1px rgba(99, 102, 241, 0.25), 0 16px 28px rgba(34, 211, 238, 0.12)'
          >
            <Icon as={BrainCircuit} h='6' w='6' color='cyan.300' />
          </Flex>
          <Box>
            <Heading
              size='md'
              color='white'
              fontStyle='italic'
              letterSpacing='0.02em'
            >
              Knowledge Brain
            </Heading>
          </Box>
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
                  borderRadius='xl'
                  transition='all 0.2s'
                  bg={
                    isActive
                      ? 'linear-gradient(90deg, rgba(99, 102, 241, 0.18), rgba(34, 211, 238, 0.08))'
                      : 'transparent'
                  }
                  color={isActive ? 'white' : 'fgMuted'}
                  borderRight={isActive ? '2px solid' : '2px solid transparent'}
                  borderColor={isActive ? 'cyan.400' : 'transparent'}
                  boxShadow={
                    isActive
                      ? 'inset 0 1px 0 rgba(255,255,255,0.06), 0 18px 32px rgba(99,102,241,0.12)'
                      : 'none'
                  }
                  _hover={{
                    bg: isActive
                      ? 'linear-gradient(90deg, rgba(99, 102, 241, 0.22), rgba(34, 211, 238, 0.1))'
                      : 'whiteAlpha.100',
                    color: 'white',
                  }}
                >
                  <Icon
                    as={item.icon}
                    h='5'
                    w='5'
                    color={isActive ? 'cyan.300' : 'inherit'}
                  />
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
