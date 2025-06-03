
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { useOSStore } from '@/store/os-store';
import { OSStatus, type CreateOSData } from '@/lib/types';
import AuthenticatedLayout from '@/components/layout/AuthenticatedLayout';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, AlertCircle, Send } from 'lucide-react';

export default function PartnerCreateOSPage() {
  const router = useRouter();
  const session = useSession();
  const addOS = useOSStore((state) => state.addOS);

  const [cliente, setCliente] = useState('');
  const [projeto, setProjeto] = useState('');
  const [tarefa, setTarefa] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!session || session.sessionType !== 'partner') {
    return (
      <AuthenticatedLayout>
        <div className="text-center py-5">
          <h1 className="h3">Acesso Negado</h1>
          <p className="text-muted">Você precisa estar logado como parceiro para criar uma OS.</p>
          <Link href="/partner-login" className="btn btn-primary">Login de Parceiro</Link>
        </div>
      </AuthenticatedLayout>
    );
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!cliente.trim() || !projeto.trim() || !tarefa.trim()) {
      setError('Todos os campos são obrigatórios.');
      return;
    }

    setIsSubmitting(true);

    const osData: CreateOSData = {
      cliente: cliente.trim(),
      parceiro: undefined, // Parceiro de execução não é definido pelo parceiro criador
      projeto: projeto.trim(),
      tarefa: tarefa.trim(),
      observacoes: `OS criada pelo parceiro: ${session.partnerName} (ID: ${session.id}).`,
      status: OSStatus.NA_FILA, // OSs de parceiros entram "Na Fila" por padrão
      programadoPara: undefined,
      isUrgent: false, // Parceiros não marcam como urgente por padrão
      checklistItems: [],
    };

    try {
      const createdOS = await addOS(osData, session.id); // Passa o ID do parceiro criador
      if (createdOS) {
        setSuccessMessage(`OS Nº ${createdOS.numero} criada com sucesso! Redirecionando...`);
        // Limpar formulário
        setCliente('');
        setProjeto('');
        setTarefa('');
        setTimeout(() => {
          router.push('/partner/dashboard');
        }, 2000);
      } else {
        setError('Falha ao criar a Ordem de Serviço. Tente novamente.');
      }
    } catch (e: any) {
      console.error("Erro ao criar OS pelo parceiro:", e);
      setError(e.message || 'Ocorreu um erro desconhecido.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthenticatedLayout>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">Criar Nova Ordem de Serviço</h1>
        <Link href="/partner/dashboard" className="btn btn-outline-secondary btn-sm">
          <ArrowLeft className="me-2" size={16} /> Voltar ao Painel do Parceiro
        </Link>
      </div>

      <div className="card shadow-sm">
        <div className="card-header">
          Preencha os detalhes da OS
        </div>
        <div className="card-body">
          {error && (
            <div className="alert alert-danger d-flex align-items-center">
              <AlertCircle size={20} className="me-2 flex-shrink-0" />
              {error}
            </div>
          )}
          {successMessage && (
            <div className="alert alert-success d-flex align-items-center">
              <CheckCircle size={20} className="me-2 flex-shrink-0" />
              {successMessage}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="cliente" className="form-label">Nome do Cliente *</label>
              <input
                type="text"
                className="form-control"
                id="cliente"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                required
                placeholder="Ex: Empresa Contratante Ltda."
              />
            </div>

            <div className="mb-3">
              <label htmlFor="projeto" className="form-label">Nome do Projeto / Solicitação *</label>
              <input
                type="text"
                className="form-control"
                id="projeto"
                value={projeto}
                onChange={(e) => setProjeto(e.target.value)}
                required
                placeholder="Ex: Campanha de Marketing Digital"
              />
            </div>

            <div className="mb-3">
              <label htmlFor="tarefa" className="form-label">Tarefa Principal / Descrição do Serviço *</label>
              <textarea
                className="form-control"
                id="tarefa"
                rows={4}
                value={tarefa}
                onChange={(e) => setTarefa(e.target.value)}
                required
                placeholder="Descreva o que precisa ser feito..."
              ></textarea>
            </div>

            <div className="d-grid">
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Enviando OS...
                  </>
                ) : (
                  <>
                    <Send size={16} className="me-2" /> Enviar Ordem de Serviço
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
        <div className="card-footer text-muted small">
          Após o envio, a OS será encaminhada para o administrador.
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
