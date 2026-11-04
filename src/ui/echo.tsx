// src/ui/echo.tsx: just a React component
import { useState } from 'react';
import { useHost } from '@agentage/widget';
import { Button, Card } from '@agentage/widget/ds'; // tokens + Button + Card from ds.agentage.io; later its own package @agentage/components
export function Echo() {
  const { tool } = useHost(); // own tools only; token stays in the host
  const [answer, setAnswer] = useState('');
  return (
    <Card title="probe">
      <Button onClick={async () => setAnswer((await tool('probe__echo', { msg: 'hi' })).msg)}>
        ping
      </Button>
      <p>{answer}</p>
    </Card>
  );
}
