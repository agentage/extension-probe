import { useState } from 'react';
import { useHost } from '@agentage/widget';
import { Button, Card } from '@agentage/widget/ds';

export function Echo() {
  const { tool } = useHost();
  const [answer, setAnswer] = useState('');
  // A refused call (no token on next) shows the host's reason, not an empty card.
  const ping = () =>
    tool('probe__echo', { msg: 'hi' }).then(
      ({ msg }) => msg,
      (error: Error) => error.message
    );
  return (
    <Card title="probe">
      <Button onClick={async () => setAnswer(await ping())}>ping</Button>
      <p>{answer}</p>
    </Card>
  );
}
