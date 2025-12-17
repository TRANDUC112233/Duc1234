import React, { useState, useEffect, Fragment } from 'react';
import toast from 'react-hot-toast';
import './IssuePage.css';

const API_URL = 'http://localhost:8080/api';

export default function IssuePage() {
  const [activeTab, setActiveTab] = useState('create');
  const [isLoading, setIsLoading] = useState(false);
  const [approvedRequests, setApprovedRequests] = useState([]);
  const [issues, setIssues] = useState([]);
  
  // Form data
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [formData, setFormData] = useState({
    receiverName: '',
    departmentId: null,
    issueDate: new Date().toISOString().split('T')[0]
  });
  
  // issueDetails giờ bao gồm manufacturer và country cho từng vật tư
  const [issueDetails, setIssueDetails] = useState([]);

  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

  // 📢 HÀM TRỢ GIÚP MỚI: Giả định kiểm tra nếu phiếu là Thuốc Gây Nghiện (GIỮ NGUYÊN TRUE CHO MỤC ĐÍCH TEST)
  const isControlledSubstanceRequest = (request) => {
    // TRẢ VỀ LUÔN TRUE để đảm bảo logic tạo phiếu chuyên biệt được kích hoạt
    // *Trong thực tế, logic này sẽ kiểm tra type của request hoặc material.
    return true; 
  };

  // Fetch dữ liệu ban đầu
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    if (!currentUser.id) return;

    try {
      setIsLoading(true);
      
      // --- START: GIẢ LẬP MOCK DATA TẠM THỜI (Dùng cho việc test giao diện) ---
      // Nếu cần dùng API thật, hãy bỏ phần này và uncomment Promise.all dưới đây
      const mockRequests = [
        { 
          id: 101, 
          createdByName: 'Nguyễn Văn A', 
          departmentId: 1, 
          departmentName: 'Khoa Dược',
          requestedAt: new Date(Date.now() - 86400000).toISOString(),
          details: [
            { materialId: 1, materialName: 'Morphine 10mg', unitName: 'Ống', qtyRequested: 50 },
            { materialId: 2, materialName: 'Fentanyl 0.1mg', unitName: 'Ống', qtyRequested: 20 },
          ]
        },
        { 
          id: 102, 
          createdByName: 'Trần Thị B', 
          departmentId: 2, 
          departmentName: 'Khoa Hồi Sức',
          requestedAt: new Date().toISOString(),
          details: [
            { materialId: 3, materialName: 'Thuốc Cảm Cúm (Không đặc biệt)', unitName: 'Viên', qtyRequested: 100 },
          ]
        },
      ];
      setApprovedRequests(mockRequests);
      setIssues([]);
      // --- END: GIẢ LẬP MOCK DATA TẠM THỜI ---


      /*       // CODE THẬT:
      const [requestsRes, issuesRes] = await Promise.all([
        fetch(`${API_URL}/issues/approved-requests`, {
          headers: { 'X-User-Id': currentUser.id.toString() }
        }),
        fetch(`${API_URL}/issues/my-issues`, {
          headers: { 'X-User-Id': currentUser.id.toString() }
        })
      ]);

      const requestsData = await requestsRes.json();
      const issuesData = await issuesRes.json();

      if (requestsData.success) {
        setApprovedRequests(requestsData.data || []);
      }

      if (issuesData.success) {
        setIssues(issuesData.data || []);
      }
      */
    } catch (error) {
      toast.error('Lỗi kết nối server');
    } finally {
      setIsLoading(false);
    }
  };

  // Chọn phiếu xin lĩnh đã duyệt
  const selectRequest = async (request) => {
    setSelectedRequest(request);
    setFormData({
      receiverName: request.createdByName || '',
      departmentId: request.departmentId,
      issueDate: new Date().toISOString().split('T')[0]
    });

    // Load tồn kho cho từng vật tư
    const detailsWithStock = await Promise.all(
      request.details.map(async (detail) => {
        let stockData = { totalStock: 0, lotStocks: [], manufacturer: '', country: '' };

        try {
          // 📢 MOCK DATA: Giả lập API tồn kho 
          if (detail.materialId === 1) { // Morphine
            stockData = {
              totalStock: 100,
              lotStocks: [
                { inventoryCardId: 10, lotNumber: 'M001', availableStock: 30, expDate: '2026-10-01T00:00:00.000Z', manufacturer: 'VN Pharma', country: 'Việt Nam' },
                { inventoryCardId: 11, lotNumber: 'M002', availableStock: 70, expDate: '2027-05-01T00:00:00.000Z', manufacturer: 'VN Pharma', country: 'Việt Nam' },
              ],
              manufacturer: 'Global Drug Co.', 
              country: 'Mỹ',
            };
          } else if (detail.materialId === 2) { // Fentanyl
            stockData = {
              totalStock: 15, // Tồn kho ít hơn yêu cầu 20
              lotStocks: [
                { inventoryCardId: 20, lotNumber: 'F123', availableStock: 15, expDate: '2025-12-31T00:00:00.000Z', manufacturer: 'EuroPharm', country: 'Pháp' },
              ],
              manufacturer: 'EuroPharm', 
              country: 'Pháp',
            };
          } else {
            // Giả lập vật tư không quản lý lô
            stockData = { totalStock: 500, lotStocks: [], manufacturer: '', country: '' };
          }
          /*
          // CODE THẬT:
          const stockRes = await fetch(`${API_URL}/inventory/stock/${detail.materialId}`);
          stockData = await stockRes.json();
          */
        } catch (error) {
          console.error("Lỗi lấy tồn kho:", error);
        }
        
        return {
          ...detail,
          // Cập nhật số lượng xuất ban đầu bằng min(yêu cầu, tồn kho) 
          qtyIssued: Math.min(detail.qtyRequested, stockData.totalStock || 0), 
          availableStock: stockData.totalStock || 0,
          lotStocks: stockData.lotStocks || [],
          // 📢 BỔ SUNG: Thông tin cần cho Phiếu Thuốc Gây Nghiện
          manufacturer: stockData.manufacturer || '', 
          country: stockData.country || '', 
          selectedLot: stockData.lotStocks.length === 1 ? stockData.lotStocks[0] : null // Nếu chỉ có 1 lô, tự động chọn
        };
      })
    );

    setIssueDetails(detailsWithStock);
  };

  // Cập nhật số lượng xuất (Đã tối ưu logic max)
  const updateQtyIssued = (materialId, qtyIssued) => {
    setIssueDetails(details => 
      details.map(detail => 
        detail.materialId === materialId 
          ? { 
                ...detail, 
                qtyIssued: Math.min(
                    qtyIssued, 
                    detail.qtyRequested, 
                    // Sử dụng nullish coalescing (??) để đảm bảo giá trị là số
                    detail.selectedLot?.availableStock ?? detail.availableStock ?? 0 
                ) 
            }
          : detail
      )
    );
  };

  // 📢 HÀM MỚI: Cập nhật Nhà sản xuất/Nước
  const updateDrugInfo = (materialId, field, value) => {
    setIssueDetails(details => 
      details.map(detail => 
        detail.materialId === materialId 
          ? { ...detail, [field]: value }
          : detail
      )
    );
  };

  // Chọn lô xuất
  const selectLot = (materialId, lotStock) => {
    setIssueDetails(details =>
      details.map(detail =>
        detail.materialId === materialId
          ? { 
              ...detail, 
              selectedLot: lotStock,
              qtyIssued: Math.min(detail.qtyIssued, lotStock?.availableStock || detail.qtyRequested),
              // 📢 Cập nhật Nhà SX/Nước từ lô (ưu tiên data của lô nếu có)
              manufacturer: lotStock?.manufacturer || detail.manufacturer || '',
              country: lotStock?.country || detail.country || ''
            }
          : detail
      )
    );
  };

  // Tính tổng tiền (Logic cũ không đổi)
  const calculateTotal = () => {
    return issueDetails.reduce((sum, detail) => {
      // Giá tạm thời, backend sẽ tính chính xác
      const price = 100000; // Giả định
      return sum + (price * (detail.qtyIssued || 0));
    }, 0);
  };

  // Validate form (Đã bổ sung kiểm tra bắt buộc Nhà SX/Nước)
  const validateForm = () => {
    if (!selectedRequest) {
      toast.error('Vui lòng chọn phiếu xin lĩnh đã duyệt');
      return false;
    }

    if (!formData.receiverName.trim()) {
      toast.error('Vui lòng nhập tên người nhận');
      return false;
    }

    for (const detail of issueDetails) {
      if (!detail.qtyIssued || detail.qtyIssued <= 0) {
        toast.error(`Số lượng xuất phải lớn hơn 0 cho ${detail.materialName}`);
        return false;
      }

      if (detail.qtyIssued > detail.qtyRequested) {
        toast.error(`Số lượng xuất không được vượt quá số lượng yêu cầu (${detail.qtyRequested})`);
        return false;
      }
      
      // Kiểm tra tồn kho lô
      const maxQty = detail.selectedLot?.availableStock ?? detail.availableStock;

      if (detail.selectedLot && detail.qtyIssued > maxQty) {
        toast.error(`Số lượng xuất vượt quá tồn kho của lô (còn ${detail.selectedLot.availableStock})`);
        return false;
      }

      // Kiểm tra tồn kho tổng (nếu chưa chọn lô hoặc không quản lý lô)
      if (!detail.selectedLot && detail.lotStocks.length === 0 && detail.availableStock < detail.qtyIssued) {
        toast.error(`Không đủ tồn kho cho ${detail.materialName} (còn ${detail.availableStock})`);
        return false;
      }
      
      if (detail.lotStocks.length > 0 && !detail.selectedLot) {
        toast.error(`Vật tư ${detail.materialName} có quản lý lô. Vui lòng chọn lô xuất.`);
        return false;
      }
      
      // 📢 LOGIC MỚI: Bắt buộc điền thông tin Nhà SX/Nước nếu là thuốc đặc biệt
      if (isControlledSubstanceRequest(selectedRequest)) {
        if (!detail.manufacturer.trim()) {
          toast.error(`Vui lòng cung cấp Nhà sản xuất cho ${detail.materialName}`);
          return false;
        }
        if (!detail.country.trim()) {
          toast.error(`Vui lòng cung cấp Tên nước sản xuất cho ${detail.materialName}`);
          return false;
        }
      }
    }

    return true;
  };

  // Submit phiếu xuất
  const handleSubmit = async () => {
    if (!validateForm()) return;

    if (!currentUser.id) {
      toast.error('Lỗi người dùng. Vui lòng đăng nhập lại.');
      return;
    }

    setIsLoading(true);
    try {
      const requestData = {
        issueReqId: selectedRequest.id,
        receiverName: formData.receiverName,
        departmentId: formData.departmentId,
        issueDate: formData.issueDate,
        // 📢 BỔ SUNG CỜ LOẠI PHIẾU
        isControlledSubstance: isControlledSubstanceRequest(selectedRequest), 
        details: issueDetails.map(detail => ({
          materialId: detail.materialId,
          inventoryCardId: detail.selectedLot?.inventoryCardId || null,
          qtyIssued: detail.qtyIssued,
          // 📢 BỔ SUNG THÔNG TIN CHO PHIẾU ĐẶC BIỆT
          manufacturer: detail.manufacturer,
          country: detail.country,
        }))
      };

      /*
      // CODE THẬT:
      const response = await fetch(`${API_URL}/issues/create-from-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': currentUser.id.toString()
        },
        body: JSON.stringify(requestData)
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Xuất kho thành công');
        // ... reset form và refresh data
      } else {
        toast.error(data.message || 'Lỗi khi xuất kho');
      }
      */

      // --- START: GIẢ LẬP XỬ LÝ API THÀNH CÔNG (Dùng cho test) ---
      await new Promise(resolve => setTimeout(resolve, 1000)); 
      toast.success(`Xuất kho Phiếu #${selectedRequest.id} thành công (Giả lập)`);
      // --- END: GIẢ LẬP XỬ LÝ API THÀNH CÔNG ---

      // Reset form
      setSelectedRequest(null);
      setFormData({
        receiverName: '',
        departmentId: null,
        issueDate: new Date().toISOString().split('T')[0]
      });
      setIssueDetails([]);
      
      // Refresh danh sách
      fetchInitialData();
      setActiveTab('history');
    } catch (error) {
      toast.error('Lỗi kết nối server');
    } finally {
      setIsLoading(false);
    }
  };

    
  return (
    <div className="issue-container">
      {/* Header */}
      <div className="issue-header">
        <h1>Quản lý xuất kho</h1>
        <div className="issue-tabs">
          <button 
            className={`tab ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            Xuất kho
          </button>
          <button 
            className={`tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            Lịch sử xuất ({issues.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="issue-content">
        {activeTab === 'create' ? (
          <div className="create-issue">
            {/* Chọn phiếu xin lĩnh đã duyệt */}
            <div className="form-section">
              <h3>Chọn phiếu xin lĩnh đã duyệt</h3>
              {selectedRequest ? (
                <div className="selected-request">
                  <div className="request-info">
                    <h4>Phiếu #{selectedRequest.id} - {selectedRequest.createdByName}</h4>
                    <p><strong>Đơn vị:</strong> {selectedRequest.departmentName}</p>
                    <p><strong>Ngày yêu cầu:</strong> {new Date(selectedRequest.requestedAt).toLocaleDateString('vi-VN')}</p>
                    <button 
                      className="btn-change"
                      onClick={() => {
                        setSelectedRequest(null);
                        setIssueDetails([]);
                      }}
                    >
                      Chọn lại
                    </button>
                  </div>
                </div>
              ) : (
                <div className="requests-list">
                  {isLoading ? (
                    <div className="loading">Đang tải danh sách...</div>
                  ) : approvedRequests.length === 0 ? (
                    <div className="empty-state">
                      <h4>Không có phiếu nào đã duyệt chờ xuất</h4>
                      <p>Vui lòng đợi lãnh đạo phê duyệt phiếu xin lĩnh</p>
                    </div>
                  ) : (
                    approvedRequests.map(request => (
                      <div key={request.id} className="request-card" onClick={() => selectRequest(request)}>
                        <div className="request-info">
                          <h4>Phiếu #{request.id}</h4>
                          <p><strong>Người gửi:</strong> {request.createdByName}</p>
                          <p><strong>Đơn vị:</strong> {request.departmentName}</p>
                          <p><strong>Số vật tư:</strong> {request.details?.length || 0} loại</p>
                        </div>
                        <div className="request-action">
                          <button className="btn-select">Chọn xuất</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Thông tin xuất kho */}
            {selectedRequest && (
              <>
                <div className="form-section">
                  <h3>Thông tin xuất kho</h3>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Người nhận *</label>
                      <input
                        type="text"
                        value={formData.receiverName}
                        onChange={(e) => setFormData({...formData, receiverName: e.target.value})}
                        placeholder="Nhập tên người nhận"
                      />
                    </div>
                    <div className="form-group">
                      <label>Ngày xuất</label>
                      <input
                        type="date"
                        value={formData.issueDate}
                        onChange={(e) => setFormData({...formData, issueDate: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                {/* Chi tiết xuất kho */}
                <div className="form-section">
                  <h3>Chi tiết xuất kho</h3>
                  <div className="issue-details">
                    <table>
                      <thead>
                        <tr>
                          <th>STT</th>
                          <th>Tên vật tư (Thuốc, nồng độ)</th>
                          <th>Đơn vị</th>
                          <th>SL yêu cầu</th>
                          <th>Tồn kho</th>
                          <th>Chọn lô xuất (Số lô, Hạn dùng)</th>
                          {/* 📢 CỘT MỚI CHO PHIẾU THUỐC ĐẶC BIỆT */}
                          {isControlledSubstanceRequest(selectedRequest) && (
                            <Fragment key="controlled-substance-headers">
                              <th>Nhà sản xuất *</th>
                              <th>Tên nước *</th>
                            </Fragment>
                          )}
                          <th>SL xuất</th>
                          <th>Ghi chú</th>
                        </tr>
                      </thead>
                      <tbody>
                        {issueDetails.map((detail, index) => (
                          <tr key={detail.materialId}>
                            <td className="text-center">{index + 1}</td>
                            <td>{detail.materialName}</td>
                            <td>{detail.unitName}</td>
                            <td className="text-center">{detail.qtyRequested}</td>
                            <td className="text-center">
                              <span className={`stock-badge ${detail.availableStock >= detail.qtyRequested ? 'sufficient' : 'insufficient'}`}>
                                {detail.availableStock}
                              </span>
                            </td>
                            <td>
                              <select
                                value={detail.selectedLot?.inventoryCardId || ''}
                                onChange={(e) => {
                                  const lotId = e.target.value;
                                  const selected = detail.lotStocks.find(lot => lot.inventoryCardId == lotId);
                                  selectLot(detail.materialId, selected || null);
                                }}
                                disabled={detail.lotStocks.length === 0}
                              >
                                <option value="">Chọn lô</option>
                                {detail.lotStocks.map(lot => (
                                  <option key={lot.inventoryCardId} value={lot.inventoryCardId}>
                                    Lô {lot.lotNumber} (còn {lot.availableStock}) - HSD: {new Date(lot.expDate).toLocaleDateString('vi-VN')}
                                  </option>
                                ))}
                              </select>
                            </td>
                            
                            {/* 📢 INPUT MỚI CHO NHÀ SẢN XUẤT */}
                            {isControlledSubstanceRequest(selectedRequest) && (
                              <td>
                                <input
                                  type="text"
                                  value={detail.manufacturer}
                                  onChange={(e) => updateDrugInfo(detail.materialId, 'manufacturer', e.target.value)}
                                  placeholder="Nhà SX"
                                  required
                                />
                              </td>
                            )}
                            
                            {/* 📢 INPUT MỚI CHO TÊN NƯỚC */}
                            {isControlledSubstanceRequest(selectedRequest) && (
                              <td>
                                <input
                                  type="text"
                                  value={detail.country}
                                  onChange={(e) => updateDrugInfo(detail.materialId, 'country', e.target.value)}
                                  placeholder="Tên nước"
                                  required
                                />
                              </td>
                            )}

                            <td>
                              <input
                                type="number"
                                value={detail.qtyIssued}
                                onChange={(e) => updateQtyIssued(detail.materialId, parseFloat(e.target.value))}
                                min="0"
                                // Đã tối ưu giá trị max để tránh NaN
                                max={Math.min(
                                  detail.qtyRequested, 
                                  detail.selectedLot?.availableStock ?? detail.availableStock ?? 0
                                )}
                                step="0.001"
                              />
                            </td>
                            <td>
                              {detail.selectedLot ? (
                                <span className="text-success">Đã chọn lô: {detail.selectedLot.lotNumber}</span>
                              ) : detail.lotStocks.length > 0 ? (
                                <span className="text-warning">Cần chọn lô xuất</span>
                              ) : (
                                <span className="text-muted">Không quản lý lô</span>
                             )}
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
                    <span>Tổng tiền (ước tính):</span>
                    <strong>{calculateTotal().toLocaleString('vi-VN')} đ</strong>
                  </div>
                  <button 
                    className="btn-submit"
                    onClick={handleSubmit}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Đang xử lý...' : 'Xác nhận xuất kho'}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="issue-history">
            {isLoading ? (
              <div className="loading">Đang tải dữ liệu...</div>
            ) : issues.length === 0 ? (
              <div className="empty-state">
                <h3>Chưa có phiếu xuất nào</h3>
                <p>Hãy tạo phiếu xuất đầu tiên bằng cách chuyển sang tab "Xuất kho"</p>
              </div>
            ) : (
              <div className="issues-list">
                {issues.map(issue => (
                  <div key={issue.id} className="issue-card">
                    <div className="issue-header">
                      <div className="issue-info">
                        <h3>Phiếu xuất #{issue.id}</h3>
                        <p><strong>Người nhận:</strong> {issue.receiverName}</p>
                        <p><strong>Ngày xuất:</strong> {new Date(issue.issueDate).toLocaleDateString('vi-VN')}</p>
                        <p><strong>Tổng tiền:</strong> {issue.totalAmount?.toLocaleString('vi-VN')} đ</p>
                      </div>
                      <div className="issue-actions">
                        <button className="btn-view">Xem chi tiết</button>
                      </div>
                    </div>
                    {issue.issueReq && (
                      <div className="issue-ref">
                        <strong>Từ phiếu xin lĩnh:</strong> #{issue.issueReq.id}
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