import React, { useContext, useEffect, useRef, useState } from 'react';
import {
  Button,
  Form,
  Input,
  Popconfirm,
  Table,
  Modal,
  Layout,
  Typography,
  message,
  Divider,
} from 'antd';
import { LogoutOutlined, UserOutlined } from '@ant-design/icons';
import axios from 'axios';
import Login from './components/Login';
import { getAuthHeaders, getCurrentRole, isAuthenticated, logout } from './services/LoginService';

const { Header, Content, Footer } = Layout;
const { Title, Text } = Typography;
const EditableContext = React.createContext(null);

const EditableRow = ({ index, ...props }) => {
  const [form] = Form.useForm();
  return (
    <Form form={form} component={false}>
      <EditableContext.Provider value={form}>
        <tr {...props} />
      </EditableContext.Provider>
    </Form>
  );
};

const EditableCell = ({
  title,
  editable,
  children,
  dataIndex,
  record,
  handleSave,
  ...restProps
}) => {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef(null);
  const form = useContext(EditableContext);

  useEffect(() => {
    if (editing) {
      inputRef.current.focus();
    }
  }, [editing]);

  const toggleEdit = () => {
    setEditing(!editing);
    form.setFieldsValue({
      [dataIndex]: record[dataIndex],
    });
  };

  const save = async () => {
    try {
      const values = await form.validateFields();
      toggleEdit();
      handleSave({
        ...record,
        ...values,
      });
    } catch (errInfo) {
      console.log('Save failed:', errInfo);
    }
  };

  let childNode = children;
  if (editable) {
    childNode = editing ? (
      <Form.Item
        style={{ margin: 0 }}
        name={dataIndex}
        rules={[{ required: true, message: `${title} is required.` }]}
      >
        <Input ref={inputRef} onPressEnter={save} onBlur={save} />
      </Form.Item>
    ) : (
      <div
        className="editable-cell-value-wrap"
        style={{ paddingRight: 24 }}
        onClick={toggleEdit}
      >
        {children}
      </div>
    );
  }

  return <td {...restProps}>{childNode}</td>;
};

const App = () => {
  const [authenticated, setAuthenticated] = useState(isAuthenticated());
  const [currentUser, setCurrentUser] = useState(localStorage.getItem('user') || '');
  const [currentRole, setCurrentRole] = useState(getCurrentRole());

  const [isLoading, setIsLoading] = useState(false);
  const [isRecommending, setIsRecommending] = useState(false);
  const [suggestEnabled, setSuggestEnabled] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [dataSource, setDataSource] = useState([]);
  const [count, setCount] = useState(1);
  const [newData, setNewData] = useState({
    activo: '',
    riesgo: '',
    impacto: '',
    tratamiento: '',
  });

  const [txData, setTxData] = useState({
    origen: '',
    destino: '',
    monto: '',
    concepto: '',
  });
  const [transactions, setTransactions] = useState([]);
  const [txLoading, setTxLoading] = useState(false);

  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const [adminUsers, setAdminUsers] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);

  const handleLoginSuccess = (response) => {
    const role = response.role || 'auditor';
    setAuthenticated(true);
    setCurrentUser(response.user);
    setCurrentRole(role);
    message.success(`Bienvenido, ${response.user}!`);
  };

  const handleLogout = () => {
    logout();
    setAuthenticated(false);
    setCurrentUser('');
    setCurrentRole('auditor');
    setTransactions([]);
    setAuditLogs([]);
    setAdminUsers([]);
    message.info('Sesion cerrada correctamente');
  };

  const handleUnauthorized = (error, fallbackMessage) => {
    if (error?.response?.status === 401) {
      handleLogout();
      message.error('La sesion expiro. Inicia sesion nuevamente.');
      return;
    }
    message.error(error?.response?.data?.error || error?.response?.data?.message || fallbackMessage);
  };

  const refreshSessionContext = async () => {
    try {
      const response = await axios.get('/api/auth/me', { headers: getAuthHeaders() });
      if (response?.data?.success) {
        const role = response.data.role || 'auditor';
        setCurrentUser(response.data.user || '');
        setCurrentRole(role);
        localStorage.setItem('role', role);
      }
    } catch {
      // Ignorado: si falla, se manejará al consumir otros endpoints.
    }
  };

  const loadTransactions = async () => {
    setTxLoading(true);
    try {
      const response = await axios.get('/api/transacciones', { headers: getAuthHeaders() });
      setTransactions(response?.data?.items || []);
    } catch (error) {
      handleUnauthorized(error, 'No se pudieron cargar las transacciones');
    } finally {
      setTxLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const response = await axios.get('/api/auditoria/logs', { headers: getAuthHeaders() });
      setAuditLogs(response?.data?.items || []);
    } catch (error) {
      handleUnauthorized(error, 'No se pudieron cargar los logs de auditoria');
    } finally {
      setAuditLoading(false);
    }
  };

  const loadAdminUsers = async () => {
    if (currentRole !== 'admin') {
      return;
    }
    setAdminLoading(true);
    try {
      const response = await axios.get('/api/admin/users', { headers: getAuthHeaders() });
      setAdminUsers(response?.data?.items || []);
    } catch (error) {
      handleUnauthorized(error, 'No se pudo cargar el panel de usuarios');
    } finally {
      setAdminLoading(false);
    }
  };

  useEffect(() => {
    if (!authenticated) {
      return;
    }

    refreshSessionContext();
    loadTransactions();
    loadAuditLogs();
    loadAdminUsers();
  }, [authenticated, currentRole]);

  const showModal = () => {
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
  };

  const handleDelete = (key) => {
    const filtered = dataSource.filter((item) => item.key !== key);
    setDataSource(filtered);
  };

  const handleOk = async () => {
    if (!newData.activo.trim()) {
      message.error('Por favor ingresa un nombre de activo');
      return;
    }

    setIsLoading(true);

    try {
      const activo = newData.activo.trim();
      const response = await axios.post(
        '/api/analizar-riesgos',
        { activo },
        { headers: getAuthHeaders() }
      );

      const { riesgos = [], impactos = [] } = response.data || {};
      const rows = riesgos.slice(0, 5).map((riesgo, index) => ({
        activo,
        riesgo,
        impacto: impactos[index] || 'Impacto no especificado',
      }));

      if (rows.length === 0) {
        message.warning('No se obtuvieron riesgos del motor de IA. Intenta nuevamente.');
      } else {
        addRows(rows);
        setSuggestEnabled(true);
        message.success(`Activo "${activo}" analizado con ${rows.length} riesgos`);
      }

      setIsModalVisible(false);
      loadAuditLogs();
    } catch (error) {
      handleUnauthorized(error, 'Error al analizar riesgos con IA');
    } finally {
      setIsLoading(false);
    }
  };

  const addRows = (rows) => {
    const start = count;
    const newRows = rows.map((item, index) => ({
      key: `${start + index}`,
      activo: item.activo,
      riesgo: item.riesgo,
      impacto: item.impacto,
      tratamiento: '-',
    }));

    setDataSource((prev) => [...prev, ...newRows]);
    setCount((prev) => prev + newRows.length);

    setNewData({
      activo: '',
      riesgo: '',
      impacto: '',
      tratamiento: '',
    });
  };

  const handleRecommendTreatment = async () => {
    if (dataSource.length === 0) {
      message.warning('No hay riesgos para recomendar tratamientos');
      return;
    }

    setIsRecommending(true);

    try {
      const updatedRows = await Promise.all(
        dataSource.map(async (item) => {
          const response = await axios.post(
            '/api/sugerir-tratamiento',
            {
              activo: item.activo,
              riesgo: item.riesgo,
              impacto: item.impacto,
            },
            { headers: getAuthHeaders() }
          );
          return {
            ...item,
            tratamiento: response?.data?.tratamiento || 'Sin tratamiento sugerido',
          };
        })
      );

      setDataSource(updatedRows);
      message.success('Tratamientos recomendados con exito');
      loadAuditLogs();
    } catch (error) {
      handleUnauthorized(error, 'Error al generar tratamientos con IA');
    } finally {
      setIsRecommending(false);
    }
  };

  const handleSave = (row) => {
    const tableData = [...dataSource];
    const index = tableData.findIndex((item) => row.key === item.key);
    const item = tableData[index];
    tableData.splice(index, 1, {
      ...item,
      ...row,
    });
    setDataSource(tableData);
  };

  const handleCreateTransaction = async () => {
    if (!txData.origen.trim() || !txData.destino.trim() || !txData.monto) {
      message.error('Origen, destino y monto son obligatorios');
      return;
    }

    setTxLoading(true);
    try {
      await axios.post('/api/transacciones', {
        origen: txData.origen,
        destino: txData.destino,
        monto: txData.monto,
        concepto: txData.concepto,
      }, { headers: getAuthHeaders() });

      message.success('Transaccion registrada');
      setTxData({ origen: '', destino: '', monto: '', concepto: '' });
      await loadTransactions();
      await loadAuditLogs();
    } catch (error) {
      handleUnauthorized(error, 'No se pudo registrar la transaccion');
    } finally {
      setTxLoading(false);
    }
  };

  const handleToggleUser = async (username) => {
    setAdminLoading(true);
    try {
      const response = await axios.post(
        `/api/admin/users/${username}/toggle-active`,
        {},
        { headers: getAuthHeaders() }
      );
      message.success(response?.data?.message || 'Usuario actualizado');
      await loadAdminUsers();
      await loadAuditLogs();
    } catch (error) {
      handleUnauthorized(error, 'No se pudo actualizar el estado del usuario');
    } finally {
      setAdminLoading(false);
    }
  };

  const handleResetPassword = async (username) => {
    setAdminLoading(true);
    try {
      const response = await axios.post(
        `/api/admin/users/${username}/reset-password`,
        { new_password: 'Cambio123' },
        { headers: getAuthHeaders() }
      );
      message.success((response?.data?.message || 'Contrasena restablecida') + ' a Cambio123');
      await loadAdminUsers();
      await loadAuditLogs();
    } catch (error) {
      handleUnauthorized(error, 'No se pudo restablecer la contrasena');
    } finally {
      setAdminLoading(false);
    }
  };

  const riskColumns = [
    {
      title: 'Activo',
      dataIndex: 'activo',
      width: '15%',
      editable: true,
    },
    {
      title: 'Riesgo',
      dataIndex: 'riesgo',
      width: '20%',
      editable: true,
    },
    {
      title: 'Impacto',
      dataIndex: 'impacto',
      width: '30%',
      editable: true,
    },
    {
      title: 'Tratamiento',
      dataIndex: 'tratamiento',
      width: '30%',
      editable: true,
    },
    {
      title: 'Operacion',
      dataIndex: 'operation',
      render: (_, record) => (
        dataSource.length >= 1 ? (
          <Popconfirm title="Seguro que quieres eliminar?" onConfirm={() => handleDelete(record.key)}>
            <a>Eliminar</a>
          </Popconfirm>
        ) : null
      ),
    },
  ];

  const txColumns = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    { title: 'Origen', dataIndex: 'origen' },
    { title: 'Destino', dataIndex: 'destino' },
    { title: 'Monto', dataIndex: 'monto', render: (value) => `S/ ${value}` },
    { title: 'Concepto', dataIndex: 'concepto' },
    { title: 'Estado', dataIndex: 'estado' },
    { title: 'Fecha', dataIndex: 'fecha' },
    { title: 'Creada por', dataIndex: 'creada_por' },
  ];

  const auditColumns = [
    { title: 'Fecha', dataIndex: 'timestamp', width: 220 },
    { title: 'Evento', dataIndex: 'event', width: 180 },
    { title: 'Detalle', dataIndex: 'detail' },
    { title: 'Usuario', dataIndex: 'username', width: 120 },
    { title: 'Severidad', dataIndex: 'severity', width: 120 },
  ];

  const userColumns = [
    { title: 'Usuario', dataIndex: 'username' },
    { title: 'Rol', dataIndex: 'role' },
    {
      title: 'Activo',
      dataIndex: 'active',
      render: (active) => (active ? 'Si' : 'No'),
    },
    { title: 'Intentos fallidos', dataIndex: 'failed_attempts' },
    {
      title: 'Acciones',
      render: (_, record) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="small" onClick={() => handleToggleUser(record.username)}>
            {record.active ? 'Desactivar' : 'Activar'}
          </Button>
          <Button size="small" onClick={() => handleResetPassword(record.username)}>
            Reset pass
          </Button>
        </div>
      ),
    },
  ];

  const components = {
    body: {
      row: EditableRow,
      cell: EditableCell,
    },
  };

  const columns = riskColumns.map((col) => {
    if (!col.editable) {
      return col;
    }
    return {
      ...col,
      onCell: (record) => ({
        record,
        editable: col.editable,
        dataIndex: col.dataIndex,
        title: col.title,
        handleSave,
      }),
    };
  });

  if (!authenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Title level={4} style={{ color: 'white', margin: 0 }}>Sistema de Auditoria de Riesgos</Title>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Text style={{ color: 'white', marginRight: 16 }}>
            <UserOutlined /> {currentUser} ({currentRole})
          </Text>
          <Button
            type="link"
            icon={<LogoutOutlined />}
            onClick={handleLogout}
            style={{ color: 'white' }}
          >
            Cerrar Sesion
          </Button>
        </div>
      </Header>

      <Content style={{ padding: '24px', background: '#fff' }}>
        <Title level={4}>Aplicacion Web de Banca - Riesgos IA</Title>
        <Button onClick={showModal} type="primary" style={{ marginBottom: 16 }}>
          + Agregar activo
        </Button>
        <Button
          onClick={handleRecommendTreatment}
          type="primary"
          loading={isRecommending}
          disabled={!suggestEnabled}
          style={{ marginBottom: 16, marginLeft: 8 }}
        >
          Recomendar tratamientos
        </Button>

        <Modal
          title="Agregar nuevo activo"
          open={isModalVisible}
          onOk={handleOk}
          onCancel={handleCancel}
          okText="Agregar"
          cancelText="Cancelar"
          confirmLoading={isLoading}
        >
          <Form layout="vertical">
            <Form.Item label="Activo">
              <Input
                name="activo"
                value={newData.activo}
                onChange={(e) => setNewData({ ...newData, activo: e.target.value })}
                placeholder="Ej: Base de datos de clientes"
              />
            </Form.Item>
          </Form>
        </Modal>

        <Table
          components={components}
          rowClassName={() => 'editable-row'}
          bordered
          dataSource={dataSource}
          columns={columns}
          pagination={false}
        />

        <Divider />
        <Title level={4}>API Transacciones</Title>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <Input
            style={{ width: 180 }}
            placeholder="Origen"
            value={txData.origen}
            onChange={(e) => setTxData({ ...txData, origen: e.target.value })}
          />
          <Input
            style={{ width: 180 }}
            placeholder="Destino"
            value={txData.destino}
            onChange={(e) => setTxData({ ...txData, destino: e.target.value })}
          />
          <Input
            style={{ width: 150 }}
            placeholder="Monto"
            type="number"
            value={txData.monto}
            onChange={(e) => setTxData({ ...txData, monto: e.target.value })}
          />
          <Input
            style={{ width: 220 }}
            placeholder="Concepto"
            value={txData.concepto}
            onChange={(e) => setTxData({ ...txData, concepto: e.target.value })}
          />
          <Button type="primary" loading={txLoading} onClick={handleCreateTransaction}>
            Crear transaccion
          </Button>
        </div>

        <Table
          rowKey="id"
          loading={txLoading}
          dataSource={transactions}
          columns={txColumns}
          pagination={{ pageSize: 5 }}
        />

        <Divider />
        <Title level={4}>Registros de Auditoria</Title>
        <Table
          rowKey={(record, index) => `${record.timestamp}-${index}`}
          loading={auditLoading}
          dataSource={auditLogs}
          columns={auditColumns}
          pagination={{ pageSize: 6 }}
        />

        {currentRole === 'admin' && (
          <>
            <Divider />
            <Title level={4}>Panel de Administracion de Usuarios</Title>
            <Table
              rowKey="username"
              loading={adminLoading}
              dataSource={adminUsers}
              columns={userColumns}
              pagination={false}
            />
            <Text type="secondary">Reset pass establece la clave a Cambio123 para pruebas.</Text>
          </>
        )}
      </Content>

      <Footer style={{ textAlign: 'center' }}>
        Sistema de Auditoria de Riesgos ©{new Date().getFullYear()}
      </Footer>
    </Layout>
  );
};

export default App;
