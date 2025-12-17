import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import './ReceiptPage.css';

const API_URL = 'http://localhost:8080/api';

export default function ReceiptPage() {
  const [activeTab, setActiveTab] = useState('history'); // Đặt mặc định là lịch sử
  const [isLoading, setIsLoading] = useState(false);
  const [units, setUnits] = useState([]);
  const [receipts, setReceipts] = useState([]);

  // Form data (chỉ dùng khi activeTab là 'create')
  const [formData, setFormData] = useState({
    receivedFrom: '',
    reason: '',
    receiptDate: new Date().toISOString().split('T')[0]
  });

  const [items, setItems] = useState([
    { id: 1, materialId: null, materialName: '', spec: '', code: '', unitId: null, unitName: '', price: 0, qtyDoc: 1, qtyActual: 1, lotNumber: '', mfgDate: '', expDate: '', category: 'D' }
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState(null);
  const [debounceTimer, setDebounceTimer] = useState(null);

  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  // XÓA BỎ ROLE CHECK:
  // const isStorekeeper = currentUser.roleCheck === 2;
  // Giả định mọi người dùng đều có quyền (hoặc kiểm tra bằng API khi submit nếu cần)
  const isCreatorAllowed = true; // Đặt thành true để cho phép mọi người dùng tạo phiếu

  // --- Logic Fetch Dữ liệu Ban đầu ---
  useEffect(() => {
    // Lấy danh sách phiếu nhập cho mọi người dùng
    fetchReceipts();

    // Tải danh sách đơn vị
    fetchUnits();
  }, []);

  const fetchUnits = async () => {
    try {
      const unitsRes = await fetch(`${API_URL}/units`);
      const unitsData = await unitsRes.json();
      if (Array.isArray(unitsData)) {
        setUnits(unitsData);
      }
    } catch (error) {
      toast.error('Lỗi tải danh sách đơn vị');
    }
  }

  const fetchReceipts = async () => {
    try {
      setIsLoading(true);
      // Tùy theo logic backend, ta dùng API đã có: my-receipts
      const response = await fetch(`${API_URL}/receipts/my-receipts`, {
        headers: { 'X-User-Id': currentUser.id.toString() }
      });
      const data = await response.json();
      if (data.success) {
        setReceipts(data.data || []);
      }
    } catch (error) {
      toast.error('Lỗi tải danh sách phiếu nhập');
    } finally {
      setIsLoading(false);
    }
  };

  // --- Logic chuyển Tab ---
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'history') {
      fetchReceipts(); // Tải lại lịch sử khi chuyển sang tab lịch sử
    }
    // Nếu chuyển sang 'create' và chưa có units, gọi fetchUnits
    if (tab === 'create' && units.length === 0) {
      fetchUnits();
    }
  };

  // --- Các hàm xử lý khác (giữ nguyên logic gốc) ---

  // Xử lý tìm kiếm vật tư từ BACKEND
  const handleSearch = async (term, index) => {
    setSearchTerm(term);
    if (term.trim() === '') {
      setSearchResults([]);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/receipts/materials/search?keyword=${encodeURIComponent(term)}`);
      const data = await response.json();

      if (data.success) {
        setSearchResults(data.data || []);
        setShowSearch(true);
        setActiveSearchIndex(index);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Lỗi tìm kiếm:', error);
      setSearchResults([]);
    }
  };

  // Debounced search để tránh gọi API quá nhiều
  const debouncedSearch = (term, index) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    const timer = setTimeout(() => {
      if (term.length >= 2) { // Chỉ tìm kiếm khi có ít nhất 2 ký tự
        handleSearch(term, index);
      } else {
        setSearchResults([]);
      }
    }, 300);

    setDebounceTimer(timer);
  };

  // Lấy chi tiết vật tư khi chọn
  const fetchMaterialDetails = async (materialId, index) => {
    try {
      const response = await fetch(`${API_URL}/receipts/materials/${materialId}`);
      const data = await response.json();

      if (data.success) {
        const material = data.data;
        const newItems = [...items];

        // Tự động điền thông tin
        newItems[index] = {
          ...newItems[index],
          materialId: material.id,
          materialName: material.name,
          spec: material.spec,
          code: material.code,
          unitId: material.unitId,
          unitName: material.unitName,
          category: material.category || 'D'
        };

        // Gợi ý từ lần nhập trước
        if (material.recentReceipt) {
          newItems[index] = {
            ...newItems[index],
            lotNumber: material.recentReceipt.lotNumber || ''
          };
        }

        // Gợi ý supplier từ form chính
        if (!formData.receivedFrom && material.recentReceipt?.supplier) {
          setFormData(prev => ({
            ...prev,
            receivedFrom: material.recentReceipt.supplier
          }));
        }

        setItems(newItems);

        // Hiển thị thông tin tồn kho
        if (material.totalStock) {
          toast.success(`${material.name} - Tồn kho hiện tại: ${material.totalStock} ${material.unitName}`, {
            duration: 3000
          });
        }
      }
    } catch (error) {
      console.error('Lỗi lấy chi tiết vật tư:', error);
    }
  };

  // Chọn vật tư từ kết quả tìm kiếm
  const selectMaterial = async (material, index) => {
    setShowSearch(false);
    setSearchTerm('');
    setSearchResults([]);

    // Điền thông tin cơ bản ngay lập tức
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      materialId: material.id,
      materialName: material.name,
      spec: material.spec || '',
      code: material.code || '',
      unitId: material.unitId || null,
      unitName: material.unitName || '',
      category: material.category || 'D'
    };
    setItems(newItems);

    // Lấy thêm chi tiết từ backend
    await fetchMaterialDetails(material.id, index);
  };

  // Thêm dòng mới
  const addNewItem = () => {
    const newId = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
    setItems([
      ...items,
      {
        id: newId,
        materialId: null,
        materialName: '',
        spec: '',
        code: '',
        unitId: null,
        unitName: '',
        price: 0,
        qtyDoc: 1,
        qtyActual: 1,
        lotNumber: '',
        mfgDate: '',
        expDate: '',
        category: 'D'
      }
    ]);
  };

  // Xóa dòng
  const removeItem = (id) => {
    if (items.length <= 1) {
      toast.error('Phải có ít nhất 1 vật tư');
      return;
    }
    setItems(items.filter(item => item.id !== id));
  };

  // Cập nhật thông tin dòng
  const updateItem = (id, field, value) => {
    const newItems = items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };

        // Nếu đang nhập tên vật tư, trigger search
        if (field === 'materialName') {
          const itemIndex = items.findIndex(item => item.id === id);
          debouncedSearch(value, itemIndex);
        }

        return updatedItem;
      }
      return item;
    });
    setItems(newItems);
  };

  // Tính tổng tiền
  const calculateTotal = () => {
    return items.reduce((sum, item) => {
      const price = parseFloat(item.price) || 0;
      const qty = parseFloat(item.qtyActual) || 0;
      return sum + (price * qty);
    }, 0);
  };

  // Validate form
  const validateForm = () => {
    if (!formData.receivedFrom.trim()) {
      toast.error('Vui lòng nhập nhà cung cấp');
      return false;
    }

    for (const item of items) {
      if (!item.materialId && !item.materialName.trim()) {
        toast.error('Vui lòng nhập tên vật tư hoặc chọn từ danh mục');
        return false;
      }

      if (!item.qtyActual || item.qtyActual <= 0) {
        toast.error('Số lượng phải lớn hơn 0');
        return false;
      }

      if (!item.price || item.price < 0) {
        toast.error('Giá không hợp lệ');
        return false;
      }

      if (!item.lotNumber.trim()) {
        toast.error('Vui lòng nhập số lô');
        return false;
      }
    }

    return true;
  };

  // Submit phiếu nhập
  const handleSubmit = async () => {
    if (!validateForm()) return;

    // BỎ QUA CHECK QUYỀN HẠN TẠO PHIẾU TẠI FRONTEND
    /*
    if (!isStorekeeper) {
      toast.error('Chỉ thủ kho được tạo phiếu nhập');
      return;
    }
    */

    setIsLoading(true);
    try {
      const requestData = {
        receivedFrom: formData.receivedFrom,
        reason: formData.reason,
        receiptDate: formData.receiptDate,
        details: items.map(item => ({
          materialId: item.materialId,
          materialName: item.materialName,
          spec: item.spec,
          code: item.code,
          unitId: item.unitId,
          price: item.price,
          qtyDoc: item.qtyDoc,
          qtyActual: item.qtyActual,
          lotNumber: item.lotNumber,
          mfgDate: item.mfgDate || null,
          expDate: item.expDate || null,
          category: item.category
        }))
      };

      const response = await fetch(`${API_URL}/receipts/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': currentUser.id.toString()
        },
        body: JSON.stringify(requestData)
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Tạo phiếu nhập kho thành công');
        // Reset form
        setFormData({
          receivedFrom: '',
          reason: '',
          receiptDate: new Date().toISOString().split('T')[0]
        });
        setItems([{
          id: 1,
          materialId: null,
          materialName: '',
          spec: '',
          code: '',
          unitId: null,
          unitName: '',
          price: 0,
          qtyDoc: 1,
          qtyActual: 1,
          lotNumber: '',
          mfgDate: '',
          expDate: '',
          category: 'D'
        }]);

        // Clear search
        setSearchTerm('');
        setSearchResults([]);
        setShowSearch(false);

        // Refresh danh sách
        fetchReceipts();
        setActiveTab('history');
      } else {
        toast.error(data.message || 'Lỗi khi tạo phiếu nhập');
      }
    } catch (error) {
      toast.error('Lỗi kết nối server');
    } finally {
      setIsLoading(false);
    }
  };


  // Đóng dropdown khi click bên ngoài
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.search-container')) {
        setShowSearch(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  // --- JSX Rendering ---
  return (
    <div className="receipt-container">
      {/* Header */}
      <div className="receipt-header">
        <h1>Quản lý nhập kho</h1>
        <div className="receipt-tabs">
          {/* LUÔN HIỂN THỊ tab Tạo phiếu nhập */}
          <button
            className={`tab ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => handleTabChange('create')}
          >
            Tạo phiếu nhập
          </button>

          <button
            className={`tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => handleTabChange('history')}
          >
            Lịch sử nhập ({receipts.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="receipt-content">
        {activeTab === 'create' ? ( // LUÔN CHO PHÉP TRUY CẬP tab 'create'
          <div className="create-receipt">
            {/* ... Form tạo phiếu nhập (giữ nguyên) ... */}
            <div className="form-section">
              <h3>Thông tin nhập kho</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label>Nhà cung cấp *</label>
                  <input
                    type="text"
                    value={formData.receivedFrom}
                    onChange={(e) => setFormData({...formData, receivedFrom: e.target.value})}
                    placeholder="Nhập tên nhà cung cấp"
                  />
                </div>
                <div className="form-group">
                  <label>Lý do nhập</label>
                  <input
                    type="text"
                    value={formData.reason}
                    onChange={(e) => setFormData({...formData, reason: e.target.value})}
                    placeholder="Nhập lý do nhập kho"
                  />
                </div>
                <div className="form-group">
                  <label>Ngày nhập</label>
                  <input
                    type="date"
                    value={formData.receiptDate}
                    onChange={(e) => setFormData({...formData, receiptDate: e.target.value})}
                  />
                </div>
              </div>
            </div>

            {/* Danh sách vật tư */}
            <div className="form-section">
              <div className="section-header">
                <h3>Danh sách vật tư</h3>
                <button className="btn-add" onClick={addNewItem}>
                  + Thêm dòng
                </button>
              </div>

              <div className="items-table">
                <table>
                  <thead>
                    <tr>
                      <th>STT</th>
                      <th>Tên vật tư *</th>
                      <th>Mã</th>
                      <th>Quy cách</th>
                      <th>Đơn vị</th>
                      <th>Đơn giá</th>
                      <th>SL thực nhận</th>
                      <th>Thành tiền</th>
                      <th>Số lô *</th>
                      <th>Hạn dùng</th>
                      <th>Loại</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={item.id}>
                        <td className="text-center">{index + 1}</td>
                        <td>
                          <div className="search-container">
                            <input
                              type="text"
                              value={item.materialName}
                              onChange={(e) => {
                                updateItem(item.id, 'materialName', e.target.value);
                              }}
                              onFocus={() => {
                                if (item.materialName.length >= 2) {
                                  handleSearch(item.materialName, index);
                                }
                              }}
                              placeholder="Nhập tên hoặc mã vật tư"
                              autoComplete="off"
                            />
                            {showSearch && activeSearchIndex === index && searchResults.length > 0 && (
                              <div className="search-results">
                                {searchResults.map(material => (
                                  <div
                                    key={material.id}
                                    className="search-result-item"
                                    onClick={() => selectMaterial(material, index)}
                                  >
                                    <div className="material-info">
                                      <div className="material-name">
                                        <span className="material-code">{material.code}</span>
                                        {material.name}
                                      </div>
                                      <div className="material-details">
                                        {material.spec && <span className="spec">{material.spec}</span>}
                                        {material.unitName && <span className="unit">{material.unitName}</span>}
                                        {material.currentStock > 0 && (
                                          <span className="stock">Tồn: {material.currentStock}</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          <input
                            type="text"
                            value={item.code}
                            onChange={(e) => updateItem(item.id, 'code', e.target.value)}
                            placeholder="Mã vật tư"
                            readOnly={item.materialId} // Chỉ đọc nếu đã chọn từ danh mục
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={item.spec}
                            onChange={(e) => updateItem(item.id, 'spec', e.target.value)}
                            placeholder="Quy cách"
                          />
                        </td>
                        <td>
                          <select
                            value={item.unitId || ''}
                            onChange={(e) => updateItem(item.id, 'unitId', e.target.value)}
                          >
                            <option value="">Chọn đơn vị</option>
                            {units.map(unit => (
                              <option key={unit.id} value={unit.id}>{unit.name}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            value={item.price}
                            onChange={(e) => updateItem(item.id, 'price', e.target.value)}
                            min="0"
                            step="1000"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={item.qtyActual}
                            onChange={(e) => updateItem(item.id, 'qtyActual', e.target.value)}
                            min="0.001"
                            step="0.001"
                          />
                        </td>
                        <td className="text-center">
                          {(item.price * item.qtyActual).toLocaleString('vi-VN')}
                        </td>
                        <td>
                          <input
                            type="text"
                            value={item.lotNumber}
                            onChange={(e) => updateItem(item.id, 'lotNumber', e.target.value)}
                            placeholder="Số lô"
                            required
                          />
                        </td>
                        <td>
                          <input
                            type="date"
                            value={item.expDate}
                            onChange={(e) => updateItem(item.id, 'expDate', e.target.value)}
                          />
                        </td>
                        <td>
                          <select
                            value={item.category}
                            onChange={(e) => updateItem(item.id, 'category', e.target.value)}
                          >
                            <option value="A">A</option>
                            <option value="B">B</option>
                            <option value="C">C</option>
                            <option value="D">D</option>
                          </select>
                        </td>
                        <td className="text-center">
                          <button
                            className="btn-remove"
                            onClick={() => removeItem(item.id)}
                            disabled={items.length <= 1}
                          >
                            Xóa
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tổng kết */}
            <div className="summary-section">
              <div className="total-amount">
                <span>Tổng tiền:</span>
                <strong>{calculateTotal().toLocaleString('vi-VN')} đ</strong>
              </div>
              <button
                className="btn-submit"
                onClick={handleSubmit}
                disabled={isLoading}
              >
                {isLoading ? 'Đang xử lý...' : 'Tạo phiếu nhập'}
              </button>
            </div>
          </div>
        ) : ( // Tab lịch sử cho mọi người dùng
          <div className="receipt-history">
            {/* ... Nội dung lịch sử nhập (giữ nguyên) ... */}
            {isLoading ? (
              <div className="loading">Đang tải dữ liệu...</div>
            ) : receipts.length === 0 ? (
              <div className="empty-state">
                <h3>Chưa có phiếu nhập nào</h3>
                <p>Hãy tạo phiếu nhập đầu tiên bằng cách chuyển sang tab "Tạo phiếu nhập"</p>
              </div>
            ) : (
              <div className="receipts-list">
                {receipts.map(receipt => (
                  <div key={receipt.id} className="receipt-card">
                    <div className="receipt-header">
                      <div className="receipt-info">
                        <h3>Phiếu nhập #{receipt.id}</h3>
                        <p><strong>Nhà cung cấp:</strong> {receipt.receivedFrom}</p>
                        <p><strong>Ngày nhập:</strong> {new Date(receipt.receiptDate).toLocaleDateString('vi-VN')}</p>
                        <p><strong>Tổng tiền:</strong> {receipt.totalAmount?.toLocaleString('vi-VN')} đ</p>
                      </div>
                      <div className="receipt-actions">
                        <button className="btn-view">Xem chi tiết</button>
                      </div>
                    </div>
                    {receipt.reason && (
                      <div className="receipt-reason">
                        <strong>Lý do:</strong> {receipt.reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}