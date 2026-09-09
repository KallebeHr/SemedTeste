# Backup nesta versão

O painel da alimentação gera um arquivo JSON local. Não usa Firebase Storage nem Cloud Functions e não executa agendamentos. A cópia inclui os dados da alimentação das escolas selecionadas, inclusive identificações privadas; guarde-a com acesso restrito.

Esse arquivo não abrange as coleções novas de publicações, alunos, notas e atendimento. Não há restauração automática. Cópias completas do projeto e políticas de recuperação precisam ser definidas pelo responsável pelo Firebase; esta entrega não criou tarefas nem recursos pagos. Consulte `../GUIA-PORTAL.md`.
