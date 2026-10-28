// Funções de formatação usadas por mais de uma aba

/** Monta o texto de resultado de uma inclusão/importação de leads, citando os telefones descartados quando houver. */
export function describeLeadsAdded(added: number, duplicates: number, invalid: number, verb: string): string {
  let message = `${added} ${verb}! (${duplicates} duplicados ignorados`;
  if (invalid > 0) message += `, ${invalid} com telefone inválido descartados`;
  return message + ')';
}

/** Exibe o timestamp do log como "dd/mm HH:MM:SS". Logs antigos (só "HH:MM:SS") são mostrados como vieram. */
export function formatLogTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;

  const day = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const time = date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  return `${day} ${time}`;
}
