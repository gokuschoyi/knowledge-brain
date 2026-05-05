import { Heading, Text, VStack } from '@chakra-ui/react';
import { Card } from '../common/Card';

export function GraphLegend() {
  return (
    <Card>
      <Heading size='sm' color='white' mb={3}>
        Legend
      </Heading>
      <VStack gap={2} align='stretch' fontSize='sm' color='slate.300'>
        <Text>Document nodes represent ingested sources.</Text>
        <Text>Entity nodes capture extracted concepts.</Text>
        <Text>Edges represent grounded relationships.</Text>
      </VStack>
    </Card>
  );
}
