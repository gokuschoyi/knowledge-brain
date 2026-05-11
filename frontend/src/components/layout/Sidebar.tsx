import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Box,
  Flex,
  Stack,
  Icon,
  Text,
  Heading,
  IconButton,
} from '@chakra-ui/react';
import {
  LayoutDashboard,
  MessageSquare,
  FileUp,
  Network,
  Zap,
  BrainCircuit,
  Brain,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { Tooltip } from '../ui/tooltip';

const MotionBox = motion.create(Box);

const NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'My Brains', icon: Brain, path: '/brains' },
  { label: 'Documents', icon: FileUp, path: '/documents' },
  { label: 'Research Chat', icon: MessageSquare, path: '/chat' },
  { label: 'Ingest Docs', icon: FileUp, path: '/ingest' },
  { label: 'Knowledge Graph', icon: Network, path: '/graph' },
  { label: 'Self Healing', icon: Zap, path: '/self-healing' },
];

export function Sidebar({
  collapsed,
  onToggleCollapse,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const location = useLocation();

  return (
    <Box display={{ base: 'none', lg: 'block' }} h='full' position='relative'>
      <MotionBox
        animate={{ width: collapsed ? 80 : 304 }}
        transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
        bg='rgba(3, 7, 18, 0.9)'
        borderRight='1px solid'
        borderColor='glassBorder'
        h='full'
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
        <Flex direction='column' h='full' p='4' position='relative'>
          <Flex
            direction={collapsed ? 'column' : 'row'}
            align='center'
            justify={collapsed ? 'center' : 'space-between'}
            gap='3'
            mb='6'
            borderRadius='2xl'
            px={collapsed ? '0' : '2'}
            transition='padding 0.26s ease'
          >
            <Flex
              align='center'
              justify='center'
              h='12'
              w='12'
              borderRadius='2xl'
              bg='linear-gradient(135deg, rgba(99, 102, 241, 0.24), rgba(34, 211, 238, 0.18))'
              boxShadow='0 0 0 1px rgba(99, 102, 241, 0.25), 0 16px 28px rgba(34, 211, 238, 0.12)'
              flexShrink={0}
            >
              <Icon as={BrainCircuit} h='6' w='6' color='cyan.300' />
            </Flex>
            {!collapsed ? (
              <>
                <MotionBox
                  initial={false}
                  animate={{ opacity: 1, x: 0, width: 'auto' }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  overflow='hidden'
                  whiteSpace='nowrap'
                  flex='1'
                >
                  <Heading
                    size='md'
                    color='white'
                    fontStyle='italic'
                    letterSpacing='0.02em'
                  >
                    Knowledge Brain
                  </Heading>
                </MotionBox>
                <IconButton
                  aria-label='Collapse sidebar'
                  size='sm'
                  bg='rgba(148, 163, 184, 0.1)'
                  color='slate.200'
                  border='1px solid'
                  borderColor='rgba(148, 163, 184, 0.18)'
                  borderRadius='xl'
                  backdropFilter='blur(10px)'
                  boxShadow='0 12px 24px rgba(3, 7, 18, 0.24)'
                  _hover={{
                    bg: 'rgba(99, 102, 241, 0.18)',
                    borderColor: 'rgba(99, 102, 241, 0.32)',
                    color: 'white',
                  }}
                  _active={{
                    bg: 'rgba(99, 102, 241, 0.22)',
                  }}
                  _focusVisible={{
                    boxShadow:
                      '0 0 0 1px rgba(255,255,255,0.06), 0 0 0 3px rgba(99,102,241,0.34)',
                  }}
                  onClick={onToggleCollapse}
                >
                  <PanelLeftClose size={16} />
                </IconButton>
              </>
            ) : (
              <IconButton
                aria-label='Expand sidebar'
                size='sm'
                bg='rgba(148, 163, 184, 0.1)'
                color='slate.200'
                border='1px solid'
                borderColor='rgba(148, 163, 184, 0.18)'
                borderRadius='xl'
                backdropFilter='blur(10px)'
                boxShadow='0 12px 24px rgba(3, 7, 18, 0.24)'
                _hover={{
                  bg: 'rgba(99, 102, 241, 0.18)',
                  borderColor: 'rgba(99, 102, 241, 0.32)',
                  color: 'white',
                }}
                _active={{
                  bg: 'rgba(99, 102, 241, 0.22)',
                }}
                _focusVisible={{
                  boxShadow:
                    '0 0 0 1px rgba(255,255,255,0.06), 0 0 0 3px rgba(99,102,241,0.34)',
                }}
                onClick={onToggleCollapse}
              >
                <PanelLeftOpen size={16} />
              </IconButton>
            )}
          </Flex>

          <Stack gap='2' flex='1'>
            {NAV_ITEMS.map((item) => {
              const isActive = location.pathname === item.path;
              const navItem = (
                <Link
                  key={item.path}
                  to={item.path}
                  style={{ display: 'block', width: '100%' }}
                >
                  <Flex
                    align='center'
                    justify={collapsed ? 'center' : 'flex-start'}
                    gap={collapsed ? '0' : '3'}
                    px={collapsed ? '0' : '4'}
                    py='3'
                    borderRadius='xl'
                    transition='all 0.2s'
                    bg={
                      isActive
                        ? 'linear-gradient(90deg, rgba(99, 102, 241, 0.18), rgba(34, 211, 238, 0.08))'
                        : 'transparent'
                    }
                    color={isActive ? 'white' : 'fgMuted'}
                    borderRight={
                      collapsed
                        ? '1px solid transparent'
                        : isActive
                          ? '2px solid'
                          : '2px solid transparent'
                    }
                    borderColor={
                      collapsed
                        ? isActive
                          ? 'rgba(34, 211, 238, 0.32)'
                          : 'transparent'
                        : isActive
                          ? 'cyan.400'
                          : 'transparent'
                    }
                    boxShadow={
                      isActive
                        ? collapsed
                          ? '0 0 0 1px rgba(34, 211, 238, 0.42), inset 0 1px 0 rgba(255,255,255,0.06), 0 18px 32px rgba(99,102,241,0.12)'
                          : 'inset 0 1px 0 rgba(255,255,255,0.06), 0 18px 32px rgba(99,102,241,0.12)'
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
                    <MotionBox
                      initial={false}
                      animate={{
                        opacity: collapsed ? 0 : 1,
                        x: collapsed ? -8 : 0,
                        width: collapsed ? 0 : 'auto',
                      }}
                      transition={{
                        duration: 0.18,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      overflow='hidden'
                      whiteSpace='nowrap'
                      pointerEvents={collapsed ? 'none' : 'auto'}
                    >
                      <Text
                        fontSize='sm'
                        fontWeight={isActive ? 'semibold' : 'medium'}
                      >
                        {item.label}
                      </Text>
                    </MotionBox>
                  </Flex>
                </Link>
              );
              return collapsed ? (
                <Tooltip
                  key={item.path}
                  content={item.label}
                  positioning={{ placement: 'right' }}
                  openDelay={120}
                >
                  {navItem}
                </Tooltip>
              ) : (
                navItem
              );
            })}
          </Stack>
        </Flex>
      </MotionBox>
    </Box>
  );
}
