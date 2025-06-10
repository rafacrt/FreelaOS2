// src/app/partner/create-os/page.tsx
'use client';

import React from 'react';
// import { useRouter } from 'next/navigation';
// import { useSession } from '@/hooks/useSession';
// import { useOSStore } from '@/store/os-store';
// import { OSStatus, type CreateOSData } from '@/lib/types';
// import AuthenticatedLayout from '@/components/layout/AuthenticatedLayout'; // Não precisamos mais disso aqui
import Link from 'next/link'; // Manteremos o Link para o botão de voltar
// import { ArrowLeft, CheckCircle, AlertCircle, Send } from 'lucide-react';

export default function PartnerCreateOSPage() {
  // const router = useRouter();
  // const session = useSession();
  // const addOS = useOSStore((state) => state.addOS);

  // const [cliente, setCliente] = useState('');
  // const [projeto, setProjeto] = useState('');
  // const [tarefa, setTarefa] = useState('');
  // const [isSubmitting, setIsSubmitting] = useState(false);
  // const [error, setError] = useState<string | null>(null);
  // const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // if (!session || session.sessionType !== 'partner') {
  //   return (
  //     // <AuthenticatedLayout> // Removido
  //       <div className="text-center py-5">
  //         <h1 className="h3">Acesso Negado</h1>
  //         <p className="text-muted">Você precisa estar logado como parceiro para criar uma OS.</p>
  //         <Link href="/partner-login" className="btn btn-primary">Login de Parceiro</Link>
  //       </div>
  //     // </AuthenticatedLayout> // Removido
  //   );
  // }

  // const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
  //   event.preventDefault();
  //   setError(null);
  //   setSuccessMessage(null);

  //   if (!cliente.trim() || !projeto.trim() || !tarefa.trim()) {
  //     setError('Todos os campos são obrigatórios.');
  //     return;
  //   }

  //   setIsSubmitting(true);

  //   const osData: CreateOSData = {
  //     cliente: cliente.trim(),
  //     parceiro: undefined, 
  //     projeto: projeto.trim(),
  //     tarefa: tarefa.trim(),
  //     observacoes: `OS criada pelo parceiro: ${session.partnerName} (ID: ${session.id}).`,
  //     status: OSStatus.AGUARDANDO_APROVACAO, 
  //     programadoPara: undefined,
  //     isUrgent: false, 
  //     checklistItems: [],
  //   };

  //   try {
  //     const createdOS = await addOS(osData, session.id); 
  //     if (createdOS) {
  //       setSuccessMessage(`OS Nº ${createdOS.numero} enviada para aprovação! Redirecionando...`);
  //       setCliente('');
  //       setProjeto('');
  //       setTarefa('');
  //       setTimeout(() => {
  //         router.push('/partner/dashboard');
  //       }, 2500);
  //     } else {
  //       setError('Falha ao criar a Ordem de Serviço. Tente novamente.');
  //     }
  //   } catch (e: any) {
  //     console.error("Erro ao criar OS pelo parceiro:", e);
  //     setError(e.message || 'Ocorreu um erro desconhecido.');
  //   } finally {
  //     setIsSubmitting(false);
  //   }
  // };

  console.log('[PartnerCreateOSPage EXTREME SIMPLIFICATION DEBUG] Renderizando componente mínimo.');

  return (
    // <AuthenticatedLayout> // Removido
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">Criar Nova Ordem de Serviço (Simplificado)</h1>
        <Link href="/partner/dashboard" className="btn btn-outline-secondary btn-sm">
          {/* <ArrowLeft className="me-2" size={16} /> */} Voltar ao Painel do Parceiro (Simplificado)
        </Link>
      </div>

      <div className="card shadow-sm">
        <div className="card-header">
          Página de Criação de OS Simplificada para Teste
        </div>
        <div className="card-body">
          <p>Se você vê esta mensagem, a página de criação de OS carregou em seu estado mínimo.</p>
          <p>A funcionalidade de formulário está temporariamente desabilitada.</p>
        </div>
      </div>
    </div>
    // </AuthenticatedLayout> // Removido
  );
}
