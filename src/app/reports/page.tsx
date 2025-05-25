
'use client';

import React from 'react';
import AuthenticatedLayout from '@/components/layout/AuthenticatedLayout';
import Link from 'next/link';
import { ArrowLeft, ListChecks, Users, Clock, BarChart3 } from 'lucide-react';

export default function ReportsMenuPage() {
  const reports = [
    {
      title: 'Tempo de Produção (OS Finalizadas)',
      description: 'Analise o tempo gasto em Ordens de Serviço que foram concluídas.',
      href: '/reports/production-time',
      icon: <Clock size={24} className="text-primary" />,
    },
    {
      title: 'OS por Cliente / Parceiro',
      description: 'Filtre e visualize Ordens de Serviço por cliente, parceiro e status.',
      href: '/reports/by-entity',
      icon: <Users size={24} className="text-info" />,
    },
    // Adicione mais relatórios aqui no futuro
    // {
    //   title: 'Relatório Financeiro (Futuro)',
    //   description: 'Acompanhe faturamento, custos e lucratividade por OS ou período.',
    //   href: '#', // Link para o futuro relatório
    //   icon: <BarChart3 size={24} className="text-success" />,
    // },
  ];

  return (
    <AuthenticatedLayout>
      <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom">
        <h1 className="h3 mb-0 d-flex align-items-center">
          <ListChecks className="me-2 text-success" /> Central de Relatórios
        </h1>
        <Link href="/dashboard" className="btn btn-outline-secondary btn-sm">
          <ArrowLeft className="me-2" size={16} /> Voltar ao Painel
        </Link>
      </div>

      <p className="text-muted mb-4">
        Selecione um tipo de relatório abaixo para visualizar dados detalhados sobre suas Ordens de Serviço.
      </p>

      <div className="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4">
        {reports.map((report, index) => (
          <div key={index} className="col">
            <div className="card h-100 shadow-sm hover-lift transition-all">
              <div className="card-body d-flex flex-column">
                <div className="d-flex align-items-start mb-3">
                  <div className="flex-shrink-0 me-3 p-2 bg-light rounded">
                    {report.icon}
                  </div>
                  <h2 className="h5 card-title mb-0 mt-1">{report.title}</h2>
                </div>
                <p className="card-text text-muted small flex-grow-1">{report.description}</p>
                {report.href === '#' ? (
                   <button className="btn btn-sm btn-outline-secondary mt-auto w-100" disabled>
                     Em Breve
                   </button>
                ) : (
                  <Link href={report.href} className="btn btn-sm btn-primary mt-auto w-100">
                    Acessar Relatório
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </AuthenticatedLayout>
  );
}
