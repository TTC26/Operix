import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AlertTriangle, BarChart2, Bell, BookOpen, Briefcase, CheckCircle, CheckSquare, ChevronDown, ChevronRight, ClipboardList, Clock, Cloud, CloudOff, Download, Factory, FileMinus, FileSignature, FileText, LayoutDashboard, Layers, LogOut, MapPin, Package, Paperclip, Pencil, Plus, Printer, Search, Settings, Shield, ShoppingCart, Square, Trash2, Truck, Users, Wrench, X } from 'lucide-react';
import { auth, watchAuth, signUp, signIn, logOut, loadCompanyData, saveCompanyData, subscribeCompanyData, resendVerificationEmail, refreshUser, getMembership, createStaffAccount, getStaffList, removeStaff, updateStaffRole, uploadDrawing, deleteDrawing, resetPassword, reauthenticateUser, deleteAllCompanyFirestore, deleteCompanyStorage, deleteFirebaseUser, lookupStaffEmail } from './firebase';

// ── Core utilities ────────────────────────────────────────────────────────────
import { ROLE_MODULES, TEST_EMAILS, PLAN_MODULES, DOC_TYPES, CONVERT_TO, EMPTY_ITEM_ROW, blankDoc, COUNTRY_CONFIG, numToWords, currency, makeFmt, computeTotals, calcModuleTax, computeStock, downloadCSV, filterByRange, loadScript, parseOCRText, styles, TaxSummaryBox, DocPrintOverlay, Modal, LetterpadPrintStyle, sanitizeLHtml, LetterheadHeader, VoucherPrintHeader, VoucherSignatory, ApprovalActions, StatusBadge, DocRow, StatCard, BIZ_BADGE, DocumentsList, ConvertDropdown, PrintModal, DateRangePicker, SpecsFields, DrawingUploader, LockedModuleScreen, TemplateMiniPreview, sendNotificationEmail } from './utils.jsx';

// ── Admin module: Auth, Sidebar, Dashboard, DocEditor, Settings, Staff, Reports ──
import { NotificationsView, ScanBillModal, ActivitySelectScreen, ActivityHomeScreen, TrialBanner, PaywallScreen, AuthScreen, VerifyEmailScreen, DeleteAccountModal, SettingsView, StaffPage, StaffModal, DASHBOARD_DOC_TYPES, ActivityColumn, Dashboard, DeptChart, SECTION_VIEWS, BIZ_SECTION_VIEWS, BizTypeCtx, SidebarCtx, NavBtn, CreateBtn, Section, BizSection, SubLabel, Sidebar, SidebarFooter, COMMON_HSN, HsnSearchModal, MEPInvoicePicker, DocEditor, AuditView, GSTR1Report, GSTR3BReport, VATReport, TaxReport } from './Admin.jsx';

// ── Business modules ──────────────────────────────────────────────────────────
import { printCustomerDetail, printAllCustomers, CustomersList, TaxIdVerifyButton, CustomerModal, VendorsList, VendorModal, ITEM_CATEGORIES, ItemsList, ItemModal, PETTY_CATEGORIES, PettyCashList, PettyCashForm, StatementPanel, PettyCashVoucherPrint, VOUCHER_ACCOUNT_HEADS, VoucherList, VoucherForm, VoucherPrintModal, PartyStatementModal, StockView, StockLedgerView, VerticalRackModule, RackCard, RackDetailModal, SlotReceiveForm, SlotIssueForm, SlotReturnForm, RackHistoryView, RackFormModal, BinCard, GRNPrint, StoreIssuePrint, StoreIssueList, GRNList, GRNForm, ENQ_STATUSES, ENQ_STATUS_COLOR, EnquiryForm, EnquiryList, CLAUSE_CATEGORIES, DEFAULT_PO_CLAUSES, TermsLibraryView, ClauseModal, TemplateModal, CONTRACT_STATUSES, CONTRACT_STATUS_COLOR, CONTRACT_STATUS_LABEL, SCOPE_SECTIONS, blankContract, ContractList, ContractEditor, ContractPrint, PARTNER_TYPES, PARTNER_STATUSES, PARTNER_STATUS_COLOR, blankPartner, ChannelPartnerList, ChannelPartnerForm, PartnerAgreement } from './Trading.jsx';
import { MONTHS, printHRLetter, printOfferLetterDoc, OfferLetterView, OfferLetterForm, HRLettersView, HRLetterForm, GULF_COUNTRIES_HR, hrExpiryDays, hrExpiryStatus, getEmpDocAlerts, printOfferLetter, EmployeesView, EmployeeDetailView, EmpSecTitle, EmpField, EmployeeHRForm, PayrollView, PayrollModal, PaySlipPrint, IndividualPaySlips } from './HR.jsx';
import { ServiceOrdersView, ServiceOrderForm, ServiceOrderPrint, ScopeOfWorkView, ScopeItemForm, AssetRegisterView, PMScheduleView, FMWorkOrderView, AMCContractView, FMSparePartsView, FMKPIView } from './Service.jsx';
import { QualityCheckList, QCModal, PartsMasterList, PartForm, EngineeringDocsList, EngDocForm, RawMaterialsList, RawMaterialForm, BOMList, BOMForm, PO_STATUS, ProductionOrderPrint, ProductionOrdersList, genBatchNumber, ProductionOrderForm, ISOPrinciplesView, DeptProceduresView, InprocessQAView, InprocessQAForm, QATestingView, QAOrderCard, PDVPrintModal, QualityDocForm, MISView, VendorEvalView, CAPAView, InternalAuditView } from './Manufacturing.jsx';
import { MepBomView, MEP_DISCIPLINES, MEP_PHASES, MEP_UNITS, getActivityProgress, MEPProjectsView, MEPProjectForm, ActivityPlannerView, DailyUpdateModal, MEPReportsView, BOMInlineEditor, ActivityForm, DailyUpdateView, UpdateForm, ProgressBoardView, ClientMaterialView, ClientMaterialForm, SiteAttendanceView, AttendanceSheet, QuarterlyEvalView, QuarterlyEvalForm, TenderView, SubcontractorView, HSEView, RABillingView, TCPrint, TCView, HandoverView } from './Construction.jsx';

export default function App() {
  const [view,             setView]           = useState('dashboard');
  const [activeDoc,        setActiveDoc]       = useState(null);
  const [user,             setUser]            = useState(null);
  const [ownerUid,         setOwnerUid]        = useState(null);
  const [authReady,        setAuthReady]       = useState(false);
  const [userRole,         setUserRole]        = useState('admin');
  const [syncStatus,       setSyncStatus]      = useState('synced');
  const [biReady,          setBiReady]         = useState(false);
  const [dataError,        setDataError]       = useState(false);
  const [editingCustomer,  setEditingCustomer] = useState(null);
  const [editingVendor,    setEditingVendor]   = useState(null);
  const [editingItem,      setEditingItem]     = useState(null);
  const [docSearch,        setDocSearch]       = useState('');

  // ── Data state ──────────────────────────────────────────────────────────────
  const [businessInfo,     _setBi]     = useState({});
  const [documents,        _setDocs]   = useState([]);
  const [customers,        _setCusts]  = useState([]);
  const [vendors,          _setVends]  = useState([]);
  const [items,            _setItems]  = useState([]);
  const [employees,        _setEmps]   = useState([]);
  const [payrollRuns,      _setPR]     = useState([]);
  const [hrLetters,        _setHRL]    = useState([]);
  const [pettyCash,        _setPC]     = useState({ openingBalance: 0, entries: [] });
  const [vouchers,         _setVouch]  = useState([]);
  const [storeIssues,      _setSIV]    = useState([]);
  const [grns,             _setGrns]   = useState([]);
  const [serviceOrders,    _setSO]     = useState([]);
  const [productionOrders, _setPO]     = useState([]);
  const [rawMaterials,     _setRM]     = useState([]);
  const [boms,             _setBoms]   = useState([]);
  const [stockLedger,      _setSL]     = useState([]);
  const [parts,            _setParts]  = useState([]);
  const [engDocs,          _setEngD]   = useState([]);
  const [enquiries,        _setEnq]    = useState([]);
  const [contracts,        _setCon]    = useState([]);
  const [channelPartners,  _setCP]     = useState([]);
  const [termsLibrary,     _setTL]     = useState({ clauses: [], templates: [] });
  const [scopeOfWork,      _setSOW]    = useState([]);
  const [qualityDocs,      _setQD]     = useState({ isoPrinciples: [], deptProcedures: [], inprocessQA: [] });
  const [pdvs,             _setPdvs]   = useState([]);
  const [siteProjects,     _setSP]     = useState([]);
  const [siteActivities,   _setSActs]  = useState([]);
  const [progressUpdates,  _setDSR]    = useState([]);
  const [clientMaterials,  _setCM]     = useState([]);
  const [siteAttendance,   _setSA]     = useState([]);
  const [evaluations,      _setEvls]   = useState([]);
  const [capaRecords,      _setCapa]   = useState([]);
  const [internalAudits,   _setAudits] = useState([]);
  const [vendorEvals,      _setVE]     = useState([]);
  // Phase 2 — MEP Suite
  const [tenders,          _setTend]   = useState([]);
  // Phase 3 — FM/AMC
  const [assets,           _setAssets] = useState([]);
  const [pmSchedules,      _setPMS]    = useState([]);
  const [fmWorkOrders,     _setFMWO]   = useState([]);
  const [amcContracts,     _setAMC]    = useState([]);
  const [fmSpareParts,     _setFMSP]   = useState([]);
  const [subcontractors,   _setSubs]   = useState([]);
  const [hseRecords,       _setHSE]    = useState({ incidents:[], toolboxTalks:[], permits:[] });
  const [raBillings,       _setRAB]    = useState([]);
  const [tcChecklists,     _setTC]     = useState([]);
  const [handoverDocs,     _setHDocs]  = useState([]);
  const [auditDocs,        _setAuditDocs]  = useState([]);
  const [rackStore,        _setRS]         = useState({ racks: [], inward: [], outward: [], returns: [] });
  const [notifications,    setNotifications] = useState([]);
  const [showDeleteModal,  setShowDeleteModal] = useState(false);
  // Tracks which BizSection the user last interacted with (for shared views like enquiries)
  const [activeBizContext, setActiveBizContext] = useState(null);
  const [sessionContext,   setSessionContext]   = useState(null); // null = show home screen

  // ── Auth ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    return watchAuth(async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setAuthReady(true);
        try {
          // TEST_EMAILS are always owner accounts — skip membership lookup entirely
          // to avoid inconsistent ownerUid across devices/browsers
          const isTestEmail = TEST_EMAILS.includes(firebaseUser.email);
          const membership = isTestEmail ? null : await Promise.race([
            getMembership(firebaseUser.uid),
            new Promise(resolve => setTimeout(() => resolve(null), 3000)),
          ]);
          if (membership) {
            // Staff member — use owner's company data, no email verification needed
            setOwnerUid(membership.ownerUid);
            setUserRole(membership.role);
          } else if (!firebaseUser.emailVerified) {
            // Owner account not yet verified — stay on verify screen
            return;
          } else {
            // Verified owner
            setOwnerUid(firebaseUser.uid);
            setUserRole('admin');
          }
        } catch {
          if (!firebaseUser.emailVerified) return;
          setOwnerUid(firebaseUser.uid);
          setUserRole('admin');
        }
      } else {
        setUser(null);
        setOwnerUid(null);
        setAuthReady(true);
      }
    });
  }, []);

  // ── Reset session state on user change (logout/re-login) ────────────────────
  useEffect(() => {
    // When user changes (login, logout, switch account), reset session so
    // ActivityHomeScreen is shown fresh and stale biReady doesn't leak through.
    setSessionContext(null);
    setActiveBizContext(null);
    setBiReady(false);
  }, [user?.uid]);

  // ── Grace period expiry check — auto-open delete modal if 30-day window passed ──
  useEffect(() => {
    if (!biReady) return;
    if (businessInfo?.deletionScheduled && businessInfo?.deletionDate) {
      if (new Date(businessInfo.deletionDate) <= new Date()) {
        setShowDeleteModal(true);
      }
    }
  }, [biReady, businessInfo?.deletionScheduled, businessInfo?.deletionDate]);

  // ── Firestore subscription ───────────────────────────────────────────────────
  useEffect(() => {
    if (!ownerUid) return;
    const unsub = subscribeCompanyData(ownerUid, (data) => {
      setDataError(false);
      setSyncStatus('synced');
      setBiReady(true);
      // SAFETY: only update state when Firestore returned real data.
      // An empty snapshot (snap.exists()=false, timing/auth race on mobile)
      // must NOT overwrite state — that would trigger mkSet persist() calls
      // with empty arrays, wiping all Firestore data.
      if (Object.keys(data).length === 0) return;
      _setBi(data.businessInfo || {});
      _setDocs(data.documents || []);
      _setCusts(data.customers || []);
      _setVends(data.vendors || []);
      _setItems(data.items || []);
      _setEmps(data.employees || []);
      _setPR(data.payrollRuns || []);
      _setHRL(data.hrLetters || []);
      _setPC(data.pettyCash || { openingBalance: 0, entries: [] });
      _setVouch(data.vouchers || []);
      _setSIV(data.storeIssues || []);
      _setGrns(data.grns || []);
      _setSO(data.serviceOrders || []);
      _setPO(data.productionOrders || []);
      _setRM(data.rawMaterials || []);
      _setBoms(data.boms || []);
      _setSL(data.stockLedger || []);
      _setParts(data.parts || []);
      _setEngD(data.engDocs || []);
      _setEnq(data.enquiries || []);
      _setCon(data.contracts || []);
      _setCP(data.channelPartners || []);
      _setTL(data.termsLibrary || { clauses: [], templates: [] });
      _setSOW(data.scopeOfWork || []);
      _setQD(data.qualityDocs || { isoPrinciples: [], deptProcedures: [], inprocessQA: [] });
      _setPdvs(data.pdvs || []);
      _setSP(data.siteProjects || []);
      _setSActs(data.siteActivities || []);
      _setDSR(data.progressUpdates || []);
      _setCM(data.clientMaterials || []);
      _setSA(data.siteAttendance || []);
      _setEvls(data.evaluations || []);
      _setCapa(data.capaRecords || []);
      _setAudits(data.internalAudits || []);
      _setVE(data.vendorEvals || []);
      _setTend(data.tenders || []);
      _setSubs(data.subcontractors || []);
      _setAssets(data.assets || []);
      _setPMS(data.pmSchedules || []);
      _setFMWO(data.fmWorkOrders || []);
      _setAMC(data.amcContracts || []);
      _setFMSP(data.fmSpareParts || []);
      _setHSE(data.hseRecords || { incidents:[], toolboxTalks:[], permits:[] });
      _setRAB(data.raBillings || []);
      _setTC(data.tcChecklists || []);
      _setHDocs(data.handoverDocs || []);
      _setAuditDocs(data.auditDocs || []);
      _setRS(data.rackStore || { racks: [], inward: [], outward: [], returns: [] });
    }, (err) => {
      console.warn('Firestore load error:', err);
      setDataError(true);
    });
    return unsub;
  }, [ownerUid]);

  // ── Persist helper ───────────────────────────────────────────────────────────
  function persist(patch) {
    if (!ownerUid) return;
    setSyncStatus('syncing');
    saveCompanyData(ownerUid, patch)
      .then(() => setSyncStatus('synced'))
      .catch(() => setSyncStatus('error'));
  }

  // ── Wrapped setters ──────────────────────────────────────────────────────────
  function mkSet(rawSet, key) {
    return (v) => {
      if (typeof v === 'function') {
        rawSet((prev) => {
          const next = v(prev);
          persist({ [key]: next });
          return next;
        });
      } else {
        rawSet(v);
        persist({ [key]: v });
      }
    };
  }

  const setBusinessInfo     = mkSet(_setBi,    'businessInfo');
  const setDocuments        = mkSet(_setDocs,  'documents');
  const setCustomers        = mkSet(_setCusts, 'customers');
  const setVendors          = mkSet(_setVends, 'vendors');
  const setItems            = mkSet(_setItems, 'items');
  const setEmployees        = mkSet(_setEmps,  'employees');
  const setPayrollRuns      = mkSet(_setPR,    'payrollRuns');
  const setHrLetters        = mkSet(_setHRL,  'hrLetters');
  const setPettyCash        = mkSet(_setPC,    'pettyCash');
  const setVouchers         = mkSet(_setVouch, 'vouchers');
  const setStoreIssues      = mkSet(_setSIV,   'storeIssues');
  const setGrns             = mkSet(_setGrns,  'grns');
  const setServiceOrders    = mkSet(_setSO,    'serviceOrders');
  const setProductionOrders = mkSet(_setPO,    'productionOrders');
  const setRawMaterials     = mkSet(_setRM,    'rawMaterials');
  const setBoms             = mkSet(_setBoms,  'boms');
  const setStockLedger      = mkSet(_setSL,    'stockLedger');
  const setParts            = mkSet(_setParts, 'parts');
  const setEngDocs          = mkSet(_setEngD,  'engDocs');
  const setEnquiries        = mkSet(_setEnq,   'enquiries');
  const setContracts        = mkSet(_setCon,   'contracts');
  const setChannelPartners  = mkSet(_setCP,    'channelPartners');
  const setTermsLibrary     = mkSet(_setTL,    'termsLibrary');
  const setScopeOfWork      = mkSet(_setSOW,   'scopeOfWork');
  const setQualityDocs      = mkSet(_setQD,    'qualityDocs');
  const setPdvs             = mkSet(_setPdvs,  'pdvs');
  const setSiteProjects     = mkSet(_setSP,    'siteProjects');
  const setSiteActivities   = mkSet(_setSActs, 'siteActivities');
  const setProgressUpdates  = mkSet(_setDSR,   'progressUpdates');
  const setClientMaterials  = mkSet(_setCM,    'clientMaterials');
  const setSiteAttendance   = mkSet(_setSA,    'siteAttendance');
  const setEvaluations      = mkSet(_setEvls,  'evaluations');
  const setCapaRecords      = mkSet(_setCapa,  'capaRecords');
  const setInternalAudits   = mkSet(_setAudits,'internalAudits');
  const setVendorEvals      = mkSet(_setVE,    'vendorEvals');
  const setTenders          = mkSet(_setTend,  'tenders');
  const setSubcontractors   = mkSet(_setSubs,  'subcontractors');
  const setHseRecords       = mkSet(_setHSE,   'hseRecords');
  const setRaBillings       = mkSet(_setRAB,   'raBillings');
  const setTcChecklists     = mkSet(_setTC,    'tcChecklists');
  const setHandoverDocs     = mkSet(_setHDocs, 'handoverDocs');
  const setAuditDocs        = mkSet(_setAuditDocs,'auditDocs');
  const setRackStore        = mkSet(_setRS,        'rackStore');
  const setAssets           = mkSet(_setAssets,'assets');
  const setPmSchedules      = mkSet(_setPMS,   'pmSchedules');
  const setFmWorkOrders     = mkSet(_setFMWO,  'fmWorkOrders');
  const setAmcContracts     = mkSet(_setAMC,   'amcContracts');
  const setFmSpareParts     = mkSet(_setFMSP,  'fmSpareParts');

  const [mepBoms, _setMepBoms] = useState([]);
  const setMepBoms = mkSet(_setMepBoms, 'mepBoms');

  // ── Document number helpers ──────────────────────────────────────────────────
  function getFY(dateStr) {
    const d = dateStr ? new Date(dateStr) : new Date();
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const fyStart = m >= 4 ? y : y - 1;
    return `${String(fyStart).slice(-2)}-${String(fyStart + 1).slice(-2)}`;
  }

  function nextDocNumber(type, bizType, dateStr) {
    const fy = getFY(dateStr);
    const prefix = DOC_TYPES[type]?.prefix || type.toUpperCase();
    // Each division has its own independent counter — same format, separate sequence
    const same = documents.filter((d) =>
      d.type === type &&
      getFY(d.date) === fy &&
      (!isMultiBiz || (d.bizType || 'trading') === bizType)
    );
    return `${prefix}/${fy}/${String(same.length + 1).padStart(3, '0')}`;
  }

  // ── Doc helpers ──────────────────────────────────────────────────────────────
  // prefill: optional extra fields to spread onto the new doc (e.g. from enquiry conversion)
  // bizType MUST be a string — passing an object is a bug; we type-guard defensively
  function startNewDoc(type, bizType, prefill = {}) {
    const today = new Date().toISOString().slice(0, 10);
    const bType = (typeof bizType === 'string' ? bizType : null) || activeTypes[0] || 'trading';
    setActiveDoc({
      ...blankDoc(type, businessInfo),
      ...prefill,
      number: nextDocNumber(type, bType, today),
      bizType: bType,
    });
    setView('doceditor');
  }

  function openDoc(doc) {
    setActiveDoc(doc);
    setView('doceditor');
  }

  function convertDoc(srcDoc, newType) {
    // Converted doc must stay in same business activity as source
    const today = new Date().toISOString().slice(0, 10);
    const bType = srcDoc.bizType || activeTypes[0] || 'trading';
    setActiveDoc({
      ...blankDoc(newType, businessInfo),
      bizType: bType,
      number: nextDocNumber(newType, bType, today),
      customerId: srcDoc.customerId,
      customerSnapshot: srcDoc.customerSnapshot,
      items: (srcDoc.items || []).map((it) => ({ ...it, id: crypto.randomUUID() })),
      notes: srcDoc.notes || '',
      terms: srcDoc.terms || '',
      discount: srcDoc.discount || 0,
      placeOfSupply: srcDoc.placeOfSupply || '',
      linkedFrom: { id: srcDoc.id, docType: srcDoc.type, docNumber: srcDoc.number },
    });
    setView('doceditor');
  }

  function handleSaveDoc(status, rejectionNote) {
    const saved = {
      ...activeDoc,
      status: status || activeDoc.status || 'draft',
      ...(rejectionNote !== undefined ? { rejectionNote, rejectedAt: Date.now() } : {}),
      ...(status === 'approved' ? { approvedAt: Date.now() } : {}),
      ...(status === 'submitted' ? { submittedAt: Date.now() } : {}),
    };
    const isNew = !documents.find((d) => d.id === saved.id);
    setDocuments((prev) => isNew ? [...prev, saved] : prev.map((d) => d.id === saved.id ? saved : d));
    if (isNew && ['invoice', 'delivery'].includes(saved.type)) {
      const entries = (saved.items || []).filter(it => it.itemId && (it.qty || 0) !== 0).map(it => ({
        id: crypto.randomUUID(), date: saved.date, docType: saved.type, docId: saved.id,
        docNumber: saved.number, itemId: it.itemId, itemName: it.name,
        qty: -(it.qty || 0), note: `${DOC_TYPES[saved.type]?.label || saved.type} ${saved.number}`,
        bizType: saved.bizType || 'trading',
      }));
      if (entries.length) setStockLedger((prev) => [...prev, ...entries]);
    }
    if (isNew && saved.type === 'purchasebill') {
      const entries = (saved.items || []).filter(it => it.itemId && (it.qty || 0) !== 0).map(it => ({
        id: crypto.randomUUID(), date: saved.date, docType: saved.type, docId: saved.id,
        docNumber: saved.number, itemId: it.itemId, itemName: it.name,
        qty: (it.qty || 0), note: `${DOC_TYPES[saved.type]?.label || saved.type} ${saved.number}`,
        bizType: saved.bizType || 'trading',
      }));
      if (entries.length) setStockLedger((prev) => [...prev, ...entries]);
    }
    // ── Notifications ──────────────────────────────────────────────────────────
    const docLabel = DOC_TYPES[saved.type]?.label || saved.type;
    const docRef = `${docLabel} ${saved.number || ''}`.trim();
    const party = saved.customerSnapshot?.name || '';
    if (status === 'submitted') {
      // Notify admin/manager that a doc needs approval
      const notif = {
        id: crypto.randomUUID(), createdAt: Date.now(), read: false,
        type: 'approval_request', docId: saved.id, docType: saved.type, docNumber: saved.number,
        forRole: 'admin',
        title: `Approval needed: ${docRef}`,
        message: `${party ? party + ' · ' : ''}Forwarded by ${user?.email || 'staff'} — awaiting your approval.`,
        action: 'open_doc',
      };
      setNotifications(prev => [notif, ...prev]);
      sendNotificationEmail(businessInfo, 'approval_request', { docRef, party, submitter: user?.email });
    }
    if (status === 'approved') {
      const notif = {
        id: crypto.randomUUID(), createdAt: Date.now(), read: false,
        type: 'approved', docId: saved.id, docType: saved.type, docNumber: saved.number,
        forRole: 'all',
        title: `Approved: ${docRef}`,
        message: `${party ? party + ' — ' : ''}${docLabel} has been approved.`,
        action: 'open_doc',
      };
      setNotifications(prev => [notif, ...prev]);
      sendNotificationEmail(businessInfo, 'approved', { docRef, party, customerEmail: saved.customerSnapshot?.email });
    }
    if (status === 'rejected') {
      const notif = {
        id: crypto.randomUUID(), createdAt: Date.now(), read: false,
        type: 'rejected', docId: saved.id, docType: saved.type, docNumber: saved.number,
        forRole: 'all',
        title: `Rejected: ${docRef}`,
        message: rejectionNote || 'Document was rejected.',
        action: 'open_doc',
      };
      setNotifications(prev => [notif, ...prev]);
    }
    setActiveDoc(null);
    setView('documents');
  }

  function deleteDoc(id) {
    if (!window.confirm('Delete this document?')) return;
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }

  async function handleLogout() { await logOut(); }

  async function cancelDeletion() {
    if (!ownerUid) return;
    await saveCompanyData(ownerUid, { deletionScheduled: false, deletionDate: null });
  }

  function exportAllData() {
    const payload = {
      exportedAt: new Date().toISOString(),
      exportedBy: user?.email || '',
      businessInfo, documents, customers, vendors, items, stockLedger, grns,
      vouchers, pettyCash, employees, payrollRuns, serviceOrders, productionOrders,
      rawMaterials, boms, parts, engDocs, enquiries, contracts, channelPartners,
      termsLibrary, scopeOfWork, qualityDocs, pdvs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `operix-data-${(businessInfo.name || 'export').replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const activeTypes = (() => {
    if (businessInfo?.activeTypes?.length) return businessInfo.activeTypes;
    const ct = businessInfo?.companyType || 'trading';
    if (ct === 'both') return ['trading','manufacturing'];
    if (ct === 'all')  return ['trading','manufacturing','service'];
    return [ct];
  })();
  const isMultiBiz = activeTypes.length > 1;
  // Resolves which division the user is currently working in (falls back to first type)
  const effectiveBizContext = (activeBizContext && activeTypes.includes(activeBizContext))
    ? activeBizContext
    : activeTypes[0] || 'trading';
  const companyType = activeTypes.length === 1 ? activeTypes[0]
    : activeTypes.includes('service') && activeTypes.includes('manufacturing') ? 'both'
    : activeTypes.includes('manufacturing') ? 'both'
    : activeTypes.includes('service') ? 'service'
    : 'trading';
  const country = (businessInfo && businessInfo.country) || 'india';

  const stats = useMemo(() => {
    // Only approved invoices count toward receivables
    const totalRevenue   = documents.filter(d => d.type === 'invoice' && d.status === 'approved').reduce((s, d) => s + (computeTotals(d, businessInfo.state, country).grandTotal || 0), 0);
    const totalPurchases = documents.filter(d => d.type === 'purchasebill' && d.status === 'approved').reduce((s, d) => s + (computeTotals(d, businessInfo.state, country).grandTotal || 0), 0);
    const voucherList    = Array.isArray(vouchers) ? vouchers : [];
    // All receipts/payments for the cash flow stats
    const totalReceived  = voucherList.filter(v => v.type === 'receipt').reduce((s, v) => s + (parseFloat(v.amount) || 0), 0);
    const totalPaid      = voucherList.filter(v => v.type === 'payment').reduce((s, v) => s + (parseFloat(v.amount) || 0), 0);
    // Outstanding = approved invoices minus order-linked receipts only (non-order receipts don't offset invoice outstanding)
    const orderReceived  = voucherList.filter(v => v.type === 'receipt' && v.voucherSubtype !== 'nonorder').reduce((s, v) => s + (parseFloat(v.amount) || 0), 0);
    const orderPaid      = voucherList.filter(v => v.type === 'payment' && v.voucherSubtype !== 'nonorder').reduce((s, v) => s + (parseFloat(v.amount) || 0), 0);
    const outstanding    = Math.max(0, totalRevenue - orderReceived);
    const payable        = Math.max(0, totalPurchases - orderPaid);
    const counts = documents.reduce((acc, d) => { if (d.type) acc[d.type] = (acc[d.type] || 0) + 1; return acc; }, {});
    const pcEntries = Array.isArray(pettyCash?.entries) ? pettyCash.entries : [];
    const pcBalance = (pettyCash?.openingBalance || 0) + pcEntries.reduce((s, e) => s + (e.credit || 0) - (e.debit || 0), 0);
    const itemCount = items.length;
    const lowStockCount = items.filter(it => {
      if (!it.minStock) return false;
      const qty = (it.openingStock || 0) + stockLedger.filter(l => l.itemId === it.id).reduce((s, l) => s + (l.qty || 0), 0);
      return qty < it.minStock;
    }).length;
    const rmCount = rawMaterials.length;
    const poCount = productionOrders.length;
    const poOpen  = productionOrders.filter(p => p.status !== 'completed' && p.status !== 'done').length;
    return { totalRevenue, totalPurchases, outstanding, payable, totalReceived, totalPaid, counts, pcBalance, itemCount, lowStockCount, rmCount, poCount, poOpen };
  }, [documents, vouchers, businessInfo, country, pettyCash, items, stockLedger, rawMaterials, productionOrders]);

  if (!authReady) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: 16, color: '#888' }}>Loading…</div>
  );
  if (!user) return <AuthScreen />;
  if (user && !user.emailVerified) return <VerifyEmailScreen user={user} onLogout={handleLogout} />;
  // Block main app from rendering until Firestore data is ready
  if (dataError && !biReady) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', gap:16, fontFamily:"'Inter',-apple-system,sans-serif", padding:'0 24px', textAlign:'center' }}>
      <div style={{ fontSize:36 }}>📡</div>
      <div style={{ fontSize:16, fontWeight:600, color:'#2C3E6B' }}>Connection error</div>
      <div style={{ fontSize:13, color:'#888', maxWidth:300 }}>Could not reach the server. Check your internet connection and try again.</div>
      <button onClick={() => { setDataError(false); setBiReady(false); }} style={{ padding:'10px 28px', borderRadius:8, background:'#2C3E6B', color:'#fff', border:'none', cursor:'pointer', fontSize:14, fontWeight:600 }}>Retry</button>
      <button onClick={handleLogout} style={{ fontSize:13, color:'#888', background:'none', border:'none', cursor:'pointer', textDecoration:'underline' }}>Sign out</button>
    </div>
  );
  if (!biReady) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: 16, color: '#888' }}>Loading…</div>
  );
  const TRIAL_DAYS = 7;
  const _trialStart    = businessInfo.trialStartDate ? new Date(businessInfo.trialStartDate) : null;
  const _trialDaysUsed = _trialStart ? Math.floor((Date.now() - _trialStart.getTime()) / 86400000) : null;
  const trialDaysLeft  = _trialDaysUsed !== null ? Math.max(0, TRIAL_DAYS - _trialDaysUsed) : null;
  const trialExpired   = _trialDaysUsed !== null && _trialDaysUsed >= TRIAL_DAYS;
  const isSubscribed   = !!businessInfo.subscriptionActive;
  const isTestAccount  = TEST_EMAILS.includes(user?.email);

  // Once data is loaded and user hasn't chosen a session workspace yet,
  // always route to setup or home screen — never fall through to main app.
  if (biReady && sessionContext === null) {
    // First-time setup: only for genuinely new accounts (created < 60 min ago)
    // This prevents mobile Firestore timing issues from triggering setup for existing users
    const _acctAge = user?.metadata?.creationTime
      ? Date.now() - new Date(user.metadata.creationTime).getTime()
      : Infinity;
    const _isNewAccount = _acctAge < 60 * 60 * 1000; // < 1 hour old
    if (ownerUid && user?.uid === ownerUid && userRole === 'admin' && !businessInfo.companyType && _isNewAccount) {
      return <ActivitySelectScreen setBusinessInfo={setBusinessInfo} isSubscribed={isSubscribed} isTestAccount={isTestAccount} user={user} onLogout={handleLogout} />;
    }
    // Every login: pick a workspace for this session
    return (
      <ActivityHomeScreen
        activeTypes={activeTypes}
        businessInfo={businessInfo}
        user={user}
        onLogout={handleLogout}
        onEnter={(type) => { setSessionContext(type); setActiveBizContext(type); }}
      />
    );
  }

  if (biReady && trialExpired && !isSubscribed && !isTestAccount) {
    return <PaywallScreen businessInfo={businessInfo} onLogout={handleLogout} isStaff={userRole !== 'admin'} />;
  }

  // Session-scoped: when a workspace is chosen, scope all views to that activity
  const sessionActiveTypes = sessionContext ? [sessionContext] : activeTypes;
  const sessionCompanyType = sessionContext || companyType;
  const sessionIsMultiBiz  = sessionActiveTypes.length > 1;
  // Filter documents to the chosen workspace (backward-compat: untagged docs show in all)
  const bizDefault  = activeTypes.length === 1 ? activeTypes[0] : 'trading';
  const sessionDocs = sessionContext
    ? documents.filter(d => (d.bizType || bizDefault) === sessionContext)
    : documents;

  // Session-scoped stats — recompute from sessionDocs so dashboard shows per-workspace figures
  const sessionStats = (() => {
    const docs = sessionDocs;
    const totalRevenue   = docs.filter(d => d.type === 'invoice' && d.status === 'approved').reduce((s, d) => s + (computeTotals(d, businessInfo.state, country).grandTotal || 0), 0);
    const totalPurchases = docs.filter(d => d.type === 'purchasebill' && d.status === 'approved').reduce((s, d) => s + (computeTotals(d, businessInfo.state, country).grandTotal || 0), 0);
    const voucherList    = Array.isArray(vouchers) ? vouchers : [];
    const sessionVouchers = sessionContext ? voucherList.filter(v => (v.bizType || bizDefault) === sessionContext) : voucherList;
    const totalReceived  = sessionVouchers.filter(v => v.type === 'receipt').reduce((s, v) => s + (parseFloat(v.amount) || 0), 0);
    const totalPaid      = sessionVouchers.filter(v => v.type === 'payment').reduce((s, v) => s + (parseFloat(v.amount) || 0), 0);
    const orderReceived  = sessionVouchers.filter(v => v.type === 'receipt' && v.voucherSubtype !== 'nonorder').reduce((s, v) => s + (parseFloat(v.amount) || 0), 0);
    const orderPaid      = sessionVouchers.filter(v => v.type === 'payment' && v.voucherSubtype !== 'nonorder').reduce((s, v) => s + (parseFloat(v.amount) || 0), 0);
    const outstanding    = Math.max(0, totalRevenue - orderReceived);
    const payable        = Math.max(0, totalPurchases - orderPaid);
    const counts = docs.reduce((acc, d) => { if (d.type) acc[d.type] = (acc[d.type] || 0) + 1; return acc; }, {});
    const pcEntries = Array.isArray(pettyCash?.entries) ? pettyCash.entries : [];
    const pcBalance = (pettyCash?.openingBalance || 0) + pcEntries.reduce((s, e) => s + (e.credit || 0) - (e.debit || 0), 0);
    const sessionItems = sessionContext ? items.filter(it => (it.bizType || bizDefault) === sessionContext) : items;
    const itemCount = sessionItems.length;
    const lowStockCount = sessionItems.filter(it => {
      if (!it.minStock) return false;
      const qty = (it.openingStock || 0) + stockLedger.filter(l => l.itemId === it.id).reduce((s, l) => s + (l.qty || 0), 0);
      return qty < it.minStock;
    }).length;
    const sessionPO = sessionContext ? productionOrders.filter(p => (p.bizType || bizDefault) === sessionContext) : productionOrders;
    const rmCount = rawMaterials.length;
    const poCount = sessionPO.length;
    const poOpen  = sessionPO.filter(p => p.status !== 'completed' && p.status !== 'done').length;
    return { totalRevenue, totalPurchases, outstanding, payable, totalReceived, totalPaid, counts, pcBalance, itemCount, lowStockCount, rmCount, poCount, poOpen };
  })();

  function renderContent() {
    if (view === 'doceditor' && activeDoc) {
      return (
        <DocEditor
          doc={activeDoc}
          setDoc={setActiveDoc}
          customers={customers}
          vendors={vendors}
          items={items}
          businessInfo={businessInfo}
          userRole={userRole}
          onSave={handleSaveDoc}
          onCancel={() => { setActiveDoc(null); setView('documents'); }}
          onAddCustomer={(c) => setEditingCustomer(c || { name: '' })}
          onAddVendor={(v) => setEditingVendor(v || { name: '' })}
          siteActivities={siteActivities}
          siteProjects={siteProjects}
          progressUpdates={progressUpdates}
          onConvert={convertDoc}
          onOpenDoc={(docId) => { const found = documents.find(d => d.id === docId); if (found) openDoc(found); }}
          documents={documents}
        />
      );
    }

    // ── Subscription gate ──────────────────────────────────────────────────────
    // Trial users get full access to evaluate — only gate subscribed users on a specific plan
    const inTrial = !trialExpired && !isSubscribed;
    if (!isTestAccount && !inTrial) {
      const _allowed = new Set(PLAN_MODULES.common);
      for (const t of activeTypes) (PLAN_MODULES[t] || []).forEach(m => _allowed.add(m));
      // Sections that belong exclusively to paid plans (not in common)
      const _gated = new Set([
        ...PLAN_MODULES.manufacturing,
        ...PLAN_MODULES.service,
        ...PLAN_MODULES.fmamc,
      ]);
      if (_gated.has(view) && !_allowed.has(view)) {
        return <LockedModuleScreen />;
      }
    }
    // ──────────────────────────────────────────────────────────────────────────

    switch (view) {
      case 'dashboard':
        return (
          <Dashboard
            stats={sessionStats}
            documents={sessionDocs}
            customers={sessionContext ? customers.filter(c => (c.bizType || bizDefault) === sessionContext) : customers}
            vendors={sessionContext ? vendors.filter(v => (v.bizType || bizDefault) === sessionContext) : vendors}
            businessInfo={businessInfo}
            startNewDoc={startNewDoc}
            openDoc={openDoc}
            setView={setView}
            vouchers={vouchers}
            pettyCash={pettyCash}
            productionOrders={productionOrders}
            rawMaterials={rawMaterials}
            items={items}
            companyType={sessionCompanyType}
            activeTypes={sessionActiveTypes}
            isMultiBiz={sessionIsMultiBiz}
            siteProjects={siteProjects}
            siteAttendance={siteAttendance}
            serviceOrders={serviceOrders}
          />
        );
      case 'enquiries':
        return (
          <EnquiryList
            enquiries={enquiries}
            setEnquiries={setEnquiries}
            customers={customers}
            userRole={userRole}
            currentBizType={effectiveBizContext}
            isMultiBiz={isMultiBiz}
            onConvertToQuotation={(enq) => {
              const cust = customers.find(c => c.id === enq.customerId);
              startNewDoc('quotation', enq.bizType || effectiveBizContext, {
                customerId: enq.customerId,
                customerSnapshot: cust || null,
                notes: enq.notes || '',
              });
            }}
          />
        );
      case 'rawmaterials':
        return (
          <RawMaterialsList
            rawMaterials={rawMaterials}
            setRawMaterials={setRawMaterials}
            userRole={userRole}
            ownerUid={ownerUid}
            businessInfo={businessInfo}
          />
        );
      case 'bom':
        return (
          <BOMList
            boms={boms}
            setBoms={setBoms}
            rawMaterials={rawMaterials}
            userRole={userRole}
            ownerUid={ownerUid}
            parts={parts}
          />
        );
      case 'productionorders':
        return (
          <ProductionOrdersList
            productionOrders={productionOrders}
            setProductionOrders={setProductionOrders}
            boms={boms}
            rawMaterials={rawMaterials}
            setRawMaterials={setRawMaterials}
            userRole={userRole}
            ownerUid={ownerUid}
            setStockLedger={setStockLedger}
            items={items}
            businessInfo={businessInfo}
          />
        );
      case 'partsmaster':
        return (
          <PartsMasterList
            parts={parts}
            setParts={setParts}
            vendors={vendors}
            ownerUid={ownerUid}
            userRole={userRole}
          />
        );
      case 'engdocs':
        return (
          <EngineeringDocsList
            engDocs={engDocs}
            setEngDocs={setEngDocs}
            parts={parts}
            ownerUid={ownerUid}
            userRole={userRole}
          />
        );
      case 'isoprinciples':
        return (
          <ISOPrinciplesView
            qualityDocs={qualityDocs}
            setQualityDocs={setQualityDocs}
            userRole={userRole}
          />
        );
      case 'deptprocedures':
        return (
          <DeptProceduresView
            qualityDocs={qualityDocs}
            setQualityDocs={setQualityDocs}
            userRole={userRole}
          />
        );
      case 'inprocessqa':
        return (
          <InprocessQAView
            qualityDocs={qualityDocs}
            setQualityDocs={setQualityDocs}
            productionOrders={productionOrders}
            userRole={userRole}
          />
        );
      case 'qatesting':
        return (
          <QATestingView
            productionOrders={productionOrders}
            setProductionOrders={setProductionOrders}
            pdvs={pdvs}
            setPdvs={setPdvs}
            setStockLedger={setStockLedger}
            boms={boms}
            items={items}
            userRole={userRole}
            businessInfo={businessInfo}
            capaRecords={capaRecords}
            setCapaRecords={setCapaRecords}
          />
        );
      case 'capa':
        return (
          <CAPAView
            capaRecords={capaRecords}
            setCapaRecords={setCapaRecords}
            vendors={vendors}
            customers={customers}
            userRole={userRole}
          />
        );
      case 'internalaudit':
        return (
          <InternalAuditView
            internalAudits={internalAudits}
            setInternalAudits={setInternalAudits}
            capaRecords={capaRecords}
            setCapaRecords={setCapaRecords}
            userRole={userRole}
          />
        );
      case 'vendoreval':
        return (
          <VendorEvalView
            vendorEvals={vendorEvals}
            setVendorEvals={setVendorEvals}
            vendors={vendors}
            userRole={userRole}
          />
        );
      case 'channelpartners':
        return (
          <ChannelPartnerList
            channelPartners={channelPartners}
            setChannelPartners={setChannelPartners}
            documents={documents}
            termsLibrary={termsLibrary}
            businessInfo={businessInfo}
            userRole={userRole}
          />
        );
      case 'contracts':
        return (
          <ContractList
            contracts={contracts}
            setContracts={setContracts}
            customers={customers}
            vendors={vendors}
            documents={documents}
            termsLibrary={termsLibrary}
            businessInfo={businessInfo}
            userRole={userRole}
          />
        );
      case 'termslibrary':
        return (
          <TermsLibraryView
            termsLibrary={termsLibrary}
            setTermsLibrary={setTermsLibrary}
            userRole={userRole}
          />
        );
      case 'documents':
        return (
          <DocumentsList
            docs={sessionDocs.filter(d => !docSearch || (d.number || '').toLowerCase().includes(docSearch.toLowerCase()) || (d.customerSnapshot?.name || '').toLowerCase().includes(docSearch.toLowerCase()))}
            customers={customers}
            vendors={vendors}
            search={docSearch}
            setSearch={setDocSearch}
            openDoc={openDoc}
            deleteDoc={deleteDoc}
            startNewDoc={startNewDoc}
            activeTypes={sessionActiveTypes}
          />
        );
      case 'customers':
        return (
          <CustomersList
            customers={sessionContext ? customers.filter(c => (c.bizType || bizDefault) === sessionContext) : customers}
            setEditing={setEditingCustomer}
            setCustomers={setCustomers}
            documents={documents}
            businessInfo={businessInfo}
          />
        );
      case 'vendors':
        return (
          <VendorsList
            vendors={sessionContext ? vendors.filter(v => (v.bizType || bizDefault) === sessionContext) : vendors}
            setEditing={setEditingVendor}
            setVendors={setVendors}
            documents={documents}
          />
        );
      case 'items':
        return (
          <ItemsList
            items={sessionContext ? items.filter(it => (it.bizType || bizDefault) === sessionContext) : items}
            setEditing={setEditingItem}
            setItems={setItems}
            businessInfo={businessInfo}
          />
        );
      case 'staff':
        return <StaffPage ownerUid={ownerUid} employees={employees} companyName={businessInfo?.name || ''} />;
      case 'settings':
        return <SettingsView businessInfo={businessInfo} setBusinessInfo={setBusinessInfo} onExportData={exportAllData} onSaved={() => setView('dashboard')} userRole={userRole} isOwner={user?.uid === ownerUid} userEmail={user?.email || ''} onRequestDelete={() => setShowDeleteModal(true)} />;
      case 'pettycash':
        return (
          <PettyCashList
            pettyCash={pettyCash}
            setPettyCash={setPettyCash}
            businessInfo={businessInfo}
            userRole={userRole}
            currentBizType={effectiveBizContext}
            isMultiBiz={isMultiBiz}
            currentUserName={user?.displayName || user?.email || ''}
          />
        );
      case 'vouchers':
        return (
          <VoucherList
            vouchers={vouchers}
            setVouchers={setVouchers}
            customers={sessionContext ? customers.filter(c => (c.bizType || bizDefault) === sessionContext) : customers}
            vendors={sessionContext ? vendors.filter(v => (v.bizType || bizDefault) === sessionContext) : vendors}
            documents={sessionDocs}
            userRole={userRole}
            businessInfo={businessInfo}
            currentBizType={effectiveBizContext}
            isMultiBiz={isMultiBiz}
          />
        );
      case 'grn':
        return (
          <GRNList
            grns={grns}
            setGrns={setGrns}
            documents={sessionDocs}
            vendors={sessionContext ? vendors.filter(v => (v.bizType || bizDefault) === sessionContext) : vendors}
            items={sessionContext ? items.filter(it => (it.bizType || bizDefault) === sessionContext) : items}
            setStockLedger={setStockLedger}
            userRole={userRole}
            businessInfo={businessInfo}
            currentBizType={effectiveBizContext}
            isMultiBiz={isMultiBiz}
          />
        );
      case 'storeissue':
        return (
          <StoreIssueList
            storeIssues={storeIssues}
            setStoreIssues={setStoreIssues}
            items={items}
            setStockLedger={setStockLedger}
            productionOrders={productionOrders}
            userRole={userRole}
            businessInfo={businessInfo}
            setNotifications={setNotifications}
            user={user}
            currentBizType={effectiveBizContext}
            isMultiBiz={isMultiBiz}
          />
        );
      case 'stock':
        return (
          <StockView
            items={items}
            stockLedger={stockLedger}
            setStockLedger={setStockLedger}
            businessInfo={businessInfo}
            userRole={userRole}
            currentBizType={effectiveBizContext}
            isMultiBiz={isMultiBiz}
          />
        );
      case 'stockledger':
        return (
          <StockLedgerView
            items={items}
            stockLedger={stockLedger}
            setStockLedger={setStockLedger}
            businessInfo={businessInfo}
          />
        );
      case 'bincard':
        return (
          <BinCard
            items={items}
            stockLedger={stockLedger}
            businessInfo={businessInfo}
            storeIssues={storeIssues}
            currentBizType={effectiveBizContext}
            isMultiBiz={isMultiBiz}
          />
        );
      case 'verticalrack':
        return (
          <VerticalRackModule
            rackStore={rackStore}
            setRackStore={setRackStore}
            items={items}
            grns={grns}
            storeIssues={storeIssues}
            setStockLedger={setStockLedger}
            businessInfo={businessInfo}
            userRole={userRole}
            currentBizType={effectiveBizContext}
            isMultiBiz={isMultiBiz}
            currentUserName={user?.displayName || user?.email || ''}
          />
        );
      case 'hr':
      case 'employees':
        return (
          <EmployeesView
            employees={employees}
            setEmployees={setEmployees}
            userRole={userRole}
            ownerUid={ownerUid}
            businessInfo={businessInfo}
          />
        );
            case 'offerletter':
        return (
          <OfferLetterView
            offerLetters={hrLetters.filter(l => l.type === 'offer')}
            setHrLetters={setHrLetters}
            employees={employees}
            userRole={userRole}
            businessInfo={businessInfo}
          />
        );
      case 'warnletter':
        return (
          <HRLettersView
            letterType="warning"
            hrLetters={hrLetters}
            setHrLetters={setHrLetters}
            employees={employees}
            userRole={userRole}
            businessInfo={businessInfo}
          />
        );
      case 'termletter':
        return (
          <HRLettersView
            letterType="termination"
            hrLetters={hrLetters}
            setHrLetters={setHrLetters}
            employees={employees}
            userRole={userRole}
            businessInfo={businessInfo}
          />
        );
      case 'payroll':
        return (
          <PayrollView
            employees={employees}
            payrollRuns={payrollRuns}
            setPayrollRuns={setPayrollRuns}
            businessInfo={businessInfo}
            userRole={userRole}
          />
        );
      case 'serviceorders':
        return (
          <ServiceOrdersView
            serviceOrders={serviceOrders}
            setServiceOrders={setServiceOrders}
            customers={customers}
            businessInfo={businessInfo}
            userRole={userRole}
          />
        );
      // ── MEP / Service Suite ─────────────────────────────────────────────────
      case 'siteprojects':
        return (
          <MEPProjectsView
            siteProjects={siteProjects}
            setSiteProjects={setSiteProjects}
            employees={employees}
            siteActivities={siteActivities}
            progressUpdates={progressUpdates}
            userRole={userRole}
          />
        );
      case 'activityplanner':
        return (
          <ActivityPlannerView
            siteActivities={siteActivities}
            setSiteActivities={setSiteActivities}
            siteProjects={siteProjects}
            progressUpdates={progressUpdates}
            setProgressUpdates={setProgressUpdates}
            userRole={userRole}
          />
        );
      case 'dailyupdates':
        return (
          <DailyUpdateView
            progressUpdates={progressUpdates}
            setProgressUpdates={setProgressUpdates}
            siteActivities={siteActivities}
            siteProjects={siteProjects}
            employees={employees}
            userRole={userRole}
          />
        );
      case 'progressboard':
        return (
          <ProgressBoardView
            siteProjects={siteProjects}
            siteActivities={siteActivities}
            progressUpdates={progressUpdates}
          />
        );
      case 'clientmaterials':
        return (
          <ClientMaterialView
            clientMaterials={clientMaterials}
            setClientMaterials={setClientMaterials}
            siteProjects={siteProjects}
            employees={employees}
            userRole={userRole}
          />
        );
      case 'siteattendance':
        return (
          <SiteAttendanceView
            siteAttendance={siteAttendance}
            setSiteAttendance={setSiteAttendance}
            siteProjects={siteProjects}
            employees={employees}
            userRole={userRole}
          />
        );
      case 'evaluation':
        return (
          <QuarterlyEvalView
            evaluations={evaluations}
            setEvaluations={setEvaluations}
            employees={employees}
            siteAttendance={siteAttendance}
            progressUpdates={progressUpdates}
            siteProjects={siteProjects}
            userRole={userRole}
          />
        );
      case 'tender':
        return (
          <TenderView
            tenders={tenders}
            setTenders={setTenders}
            customers={customers}
            siteProjects={siteProjects}
            userRole={userRole}
            businessInfo={businessInfo}
          />
        );
      case 'rabilling':
        return (
          <RABillingView
            raBillings={raBillings}
            setRaBillings={setRaBillings}
            siteProjects={siteProjects}
            customers={customers}
            tenders={tenders}
            userRole={userRole}
            businessInfo={businessInfo}
          />
        );
      case 'subcontractors':
        return (
          <SubcontractorView
            subcontractors={subcontractors}
            setSubcontractors={setSubcontractors}
            siteProjects={siteProjects}
            userRole={userRole}
            businessInfo={businessInfo}
          />
        );
      case 'hse':
        return (
          <HSEView
            hseRecords={hseRecords}
            setHseRecords={setHseRecords}
            siteProjects={siteProjects}
            userRole={userRole}
            businessInfo={businessInfo}
          />
        );
      case 'tcommissioning':
        return (
          <TCView
            tcChecklists={tcChecklists}
            setTcChecklists={setTcChecklists}
            siteProjects={siteProjects}
            userRole={userRole}
            businessInfo={businessInfo}
          />
        );
      case 'handover':
        return (
          <HandoverView
            handoverDocs={handoverDocs}
            setHandoverDocs={setHandoverDocs}
            siteProjects={siteProjects}
            customers={customers}
            userRole={userRole}
            businessInfo={businessInfo}
          />
        );
      case 'mepreports':
        return (
          <MEPReportsView
            siteProjects={siteProjects}
            siteActivities={siteActivities}
            progressUpdates={progressUpdates}
            employees={employees}
            businessInfo={businessInfo}
          />
        );
      case 'scopeofwork':
        return (
          <ScopeOfWorkView
            scopeOfWork={scopeOfWork}
            setScopeOfWork={setScopeOfWork}
            userRole={userRole}
          />
        );
      case 'mepbom':
        return (
          <MepBomView
            mepBoms={mepBoms}
            setMepBoms={setMepBoms}
            siteProjects={siteProjects}
            scopeOfWork={scopeOfWork}
            siteActivities={siteActivities}
            setSiteActivities={setSiteActivities}
            userRole={userRole}
            businessInfo={businessInfo}
          />
        );
      case 'mis':
        return (
          <MISView
            productionOrders={productionOrders}
            pdvs={pdvs}
            capaRecords={capaRecords}
            internalAudits={internalAudits}
            vendorEvals={vendorEvals}
            vendors={vendors}
            documents={documents}
            stockLedger={stockLedger}
            items={items}
            employees={employees}
            businessInfo={businessInfo}
          />
        );
      case 'fmkpi':
        return (
          <FMKPIView
            assets={assets}
            pmSchedules={pmSchedules}
            fmWorkOrders={fmWorkOrders}
            amcContracts={amcContracts}
            fmSpareParts={fmSpareParts}
            businessInfo={businessInfo}
          />
        );
      case 'assetregister':
        return (
          <AssetRegisterView
            assets={sessionContext ? assets.filter(a => (a.bizType || 'fmamc') === sessionContext) : assets}
            setAssets={setAssets}
            userRole={userRole}
            businessInfo={businessInfo}
            currentBizType={sessionContext || effectiveBizContext || 'fmamc'}
          />
        );
      case 'pmschedules':
        return (
          <PMScheduleView
            pmSchedules={pmSchedules}
            setPmSchedules={setPmSchedules}
            assets={assets}
            fmWorkOrders={fmWorkOrders}
            setFmWorkOrders={setFmWorkOrders}
            userRole={userRole}
          />
        );
      case 'fmworkorders':
        return (
          <FMWorkOrderView
            fmWorkOrders={fmWorkOrders}
            setFmWorkOrders={setFmWorkOrders}
            assets={assets}
            fmSpareParts={fmSpareParts}
            setFmSpareParts={setFmSpareParts}
            userRole={userRole}
          />
        );
      case 'amccontracts':
        return (
          <AMCContractView
            amcContracts={amcContracts}
            setAmcContracts={setAmcContracts}
            customers={customers}
            assets={assets}
            userRole={userRole}
            businessInfo={businessInfo}
          />
        );
      case 'fmspareparts':
        return (
          <FMSparePartsView
            fmSpareParts={fmSpareParts}
            setFmSpareParts={setFmSpareParts}
            assets={assets}
            userRole={userRole}
          />
        );
      case 'gstr1':
        return (
          <GSTR1Report
            documents={documents}
            customers={customers}
            businessInfo={businessInfo}
          />
        );
      case 'gstr3b':
        return (
          <GSTR3BReport
            documents={documents}
            customers={customers}
            vendors={vendors}
            businessInfo={businessInfo}
          />
        );
      case 'vatreport':
        return (
          <VATReport
            documents={documents}
            customers={customers}
            businessInfo={businessInfo}
          />
        );
      case 'taxreport':
        return (
          <TaxReport
            documents={documents}
            customers={customers}
            businessInfo={businessInfo}
          />
        );
      case 'audit':
        return (
          <AuditView
            documents={documents}
            vouchers={vouchers}
            pettyCash={pettyCash}
            businessInfo={businessInfo}
            userRole={userRole}
            currentBizType={effectiveBizContext}
            isMultiBiz={isMultiBiz}
            auditDocs={auditDocs}
            setAuditDocs={setAuditDocs}
          />
        );
      case 'notifications':
        return (
          <NotificationsView
            notifications={notifications}
            setNotifications={setNotifications}
            documents={documents}
            openDoc={openDoc}
            userRole={userRole}
          />
        );
      default:
        return (
          <Dashboard
            stats={sessionStats}
            documents={sessionDocs}
            customers={sessionContext ? customers.filter(c => (c.bizType || bizDefault) === sessionContext) : customers}
            vendors={sessionContext ? vendors.filter(v => (v.bizType || bizDefault) === sessionContext) : vendors}
            businessInfo={businessInfo}
            startNewDoc={startNewDoc}
            openDoc={openDoc}
            setView={setView}
            vouchers={vouchers}
            pettyCash={pettyCash}
            productionOrders={sessionContext ? productionOrders.filter(p => (p.bizType || bizDefault) === sessionContext) : productionOrders}
            rawMaterials={rawMaterials}
            items={sessionContext ? items.filter(it => (it.bizType || bizDefault) === sessionContext) : items}
            companyType={sessionCompanyType}
            activeTypes={sessionActiveTypes}
            isMultiBiz={sessionIsMultiBiz}
            siteProjects={siteProjects}
            siteAttendance={siteAttendance}
            serviceOrders={sessionContext ? serviceOrders.filter(s => (s.bizType || bizDefault) === sessionContext) : serviceOrders}
          />
        );
    }
  }

  const unreadCount = notifications.filter(n => !n.read && (n.forRole === 'all' || n.forRole === userRole)).length;

  return (
    <div style={styles.app} className="no-print-bg">
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
        .serif { font-family: 'Lora', Georgia, serif; }
        button { cursor: pointer; font-family: inherit; }
        input, textarea, select { font-family: inherit; }
        @media print {
          .no-print, .no-print * { display: none !important; }
          .no-print-bg { background: transparent !important; }
          html, body { overflow: visible !important; height: auto !important; background: #fff !important; }
          body > * { visibility: hidden !important; overflow: visible !important; }
          .print-area { visibility: visible !important; }
          .print-area * { visibility: visible !important; overflow: visible !important; }
          .print-area {
            position: absolute !important;
            top: 0 !important; left: 0 !important;
            width: 100% !important; height: auto !important;
            overflow: visible !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            z-index: 99999 !important;
            padding: 12mm !important;
            margin: 0 !important;
            background: #fff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .draft-watermark {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color: rgba(185, 28, 28, 0.13) !important;
          }
        }
        @page { size: A4; margin: 15mm; }
      `}</style>
      <Sidebar
        view={view}
        setView={setView}
        setActiveDoc={setActiveDoc}
        startNewDoc={startNewDoc}
        syncStatus={syncStatus}
        user={user}
        onLogout={handleLogout}
        userRole={userRole}
        companyType={sessionCompanyType}
        activeTypes={sessionActiveTypes}
        country={country}
        unreadCount={unreadCount}
        onShowNotifications={() => setView('notifications')}
        activeDocBizType={activeDoc?.bizType || null}
        activeBizContext={effectiveBizContext}
        onBizContextChange={setActiveBizContext}
        onSwitchActivity={activeTypes.length > 1 ? () => setSessionContext(null) : null}
      />
      {/* Bell — fixed top-right, hidden during print */}
      <button
        className="no-print"
        onClick={() => setView('notifications')}
        title="Notifications"
        style={{
          position: 'fixed', top: 12, right: 16, zIndex: 900,
          background: view === 'notifications' ? '#C9A24B' : '#1E2A4A',
          border: 'none', borderRadius: '50%', width: 38, height: 38,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        }}>
        <Bell size={17} color="#fff" strokeWidth={1.8} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: -2, right: -2,
            background: '#E07A3A', color: '#fff', borderRadius: 10,
            fontSize: 9, fontWeight: 700, padding: '1px 4px',
            minWidth: 14, textAlign: 'center', lineHeight: '13px',
            border: '1.5px solid #fff',
          }}>{unreadCount}</span>
        )}
      </button>

      <div style={styles.main}>
        {trialDaysLeft !== null && trialDaysLeft > 0 && !isSubscribed && (
          <TrialBanner daysLeft={trialDaysLeft} onUpgrade={() => setView('settings')} />
        )}
        {/* Deletion-scheduled banner */}
        {businessInfo?.deletionScheduled && businessInfo?.deletionDate && (
          <div style={{
            background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10,
            padding: '12px 20px', margin: '12px 24px 0', display: 'flex',
            alignItems: 'center', justifyContent: 'space-between', gap: 12,
          }}>
            <div>
              <span style={{ fontWeight: 700, color: '#B91C1C', fontSize: 13 }}>⚠ Account deletion scheduled — </span>
              <span style={{ fontSize: 13, color: '#555' }}>
                Your account and all data will be permanently deleted on{' '}
                <strong>{new Date(businessInfo.deletionDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.
              </span>
            </div>
            <button
              onClick={cancelDeletion}
              style={{ padding: '6px 16px', background: '#fff', border: '1.5px solid #B91C1C', borderRadius: 7, color: '#B91C1C', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Cancel deletion
            </button>
          </div>
        )}
        {renderContent()}
      </div>

      {/* Powered-by watermark — shown during trial, hidden once subscribed */}
      {!isSubscribed && trialDaysLeft !== null && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '5px 16px', gap: 6,
          background: 'rgba(30,42,74,0.92)',
          color: '#fff', fontSize: 11, letterSpacing: 0.3,
          pointerEvents: 'none',
        }}>
          <span style={{ opacity: 0.55 }}>Powered by</span>
          <strong style={{ marginLeft: 3 }}>Operix</strong>
        </div>
      )}

      {/* Customer / Vendor / Item modals */}
      {editingCustomer && (
        <CustomerModal
          customer={editingCustomer}
          onSave={(c) => {
            const saved = c.id ? c : { ...c, id: Date.now().toString(), bizType: sessionContext || effectiveBizContext };
            setCustomers(prev => c.id ? prev.map(x => x.id === c.id ? saved : x) : [...prev, saved]);
            setEditingCustomer(null);
          }}
          onClose={() => setEditingCustomer(null)}
          businessInfo={businessInfo}
        />
      )}
      {editingVendor && (
        <VendorModal
          vendor={editingVendor}
          onSave={(v) => {
            const saved = v.id ? v : { ...v, id: Date.now().toString(), bizType: sessionContext || effectiveBizContext };
            setVendors(prev => v.id ? prev.map(x => x.id === v.id ? saved : x) : [...prev, saved]);
            setEditingVendor(null);
          }}
          onClose={() => setEditingVendor(null)}
          businessInfo={businessInfo}
        />
      )}
      {editingItem && (
        <ItemModal
          item={editingItem}
          onSave={(it) => {
            const saved = it.id ? it : { ...it, id: Date.now().toString(), bizType: sessionContext || effectiveBizContext };
            setItems(prev => it.id ? prev.map(x => x.id === it.id ? saved : x) : [...prev, saved]);
            setEditingItem(null);
          }}
          onClose={() => setEditingItem(null)}
          businessInfo={businessInfo}
        />
      )}

      {/* Delete-account modal */}
      {showDeleteModal && (
        <DeleteAccountModal
          user={user}
          ownerUid={ownerUid}
          isSubscribed={isSubscribed}
          onExportData={null}
          onClose={() => setShowDeleteModal(false)}
          onDeleted={handleLogout}
        />
      )}
    </div>
  );
}


